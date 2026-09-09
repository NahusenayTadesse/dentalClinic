import { and, eq, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { bankAmount, bankInsertHistory } from '$lib/server/db/schema';
import { notDeleted } from '$lib/server/softDelete';

/** The transaction handle drizzle hands to `db.transaction(async (tx) => …)`. */
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Money movement in and out of the company's bank accounts.
 *
 * Two rules hold everywhere:
 *
 * 1. `bankInsertHistory.amount` is **signed** — positive is money in, negative
 *    is money out — and every row is tied to the transaction that caused it.
 * 2. `bankAmount.amount` is a running balance that moves by exactly that signed
 *    amount, in the same database transaction.
 *
 * Together they mean the live history rows for a transaction always sum to what
 * that transaction currently contributes to the balance. Nothing here recomputes
 * a balance from scratch; reversals read back what was actually posted, so they
 * cannot drift from it.
 */

/** Resolves the bank account that a payment method's money lands in. */
export async function bankForPaymentMethod(
	tx: Tx,
	paymentMethodId: number | null | undefined
): Promise<number | null> {
	if (!paymentMethodId) return null;

	const [bank] = await tx
		.select({ id: bankAmount.id })
		.from(bankAmount)
		.where(and(eq(bankAmount.paymentMethodId, paymentMethodId), notDeleted(bankAmount)))
		.limit(1);

	return bank?.id ?? null;
}

/** The payment method a bank account is reached through — the inverse lookup. */
export async function paymentMethodForBank(tx: Tx, bankAmountId: number): Promise<number | null> {
	const [row] = await tx
		.select({ paymentMethodId: bankAmount.paymentMethodId })
		.from(bankAmount)
		.where(eq(bankAmount.id, bankAmountId))
		.limit(1);

	return row?.paymentMethodId ?? null;
}

/**
 * What this transaction currently contributes to a bank balance: the sum of its
 * live history rows. Zero means nothing is posted — either it never was, or it
 * was posted and later reversed.
 *
 * This is the guard that makes approve/reject/delete idempotent. A payment can
 * bounce between approved and rejected any number of times without the balance
 * drifting, because each step asks what is actually posted rather than assuming.
 */
export async function bankNetForTransaction(tx: Tx, transactionId: number): Promise<number> {
	const [row] = await tx
		.select({ net: sql<string | null>`SUM(${bankInsertHistory.amount})` })
		.from(bankInsertHistory)
		.where(and(eq(bankInsertHistory.transactionId, transactionId), notDeleted(bankInsertHistory)));

	return Number(row?.net ?? 0);
}

/**
 * Posts a signed amount to a bank account and records why.
 *
 * Always use this rather than updating `bankAmount` directly — writing the
 * balance without the matching history row is what lets the two drift apart.
 */
export async function postToBank(
	tx: Tx,
	entry: {
		bankAmountId: number;
		transactionId: number;
		/** Signed: positive money in, negative money out. */
		amount: number;
		reason: string;
		userId?: string;
	}
): Promise<void> {
	if (!entry.amount) return;

	await tx.insert(bankInsertHistory).values({
		bankAmountId: entry.bankAmountId,
		transactionId: entry.transactionId,
		amount: String(entry.amount),
		reason: entry.reason,
		createdBy: entry.userId
	});

	await tx
		.update(bankAmount)
		.set({
			amount: sql`${bankAmount.amount} + ${String(entry.amount)}`,
			updatedBy: entry.userId
		})
		.where(eq(bankAmount.id, entry.bankAmountId));
}

/**
 * Gives back whatever a transaction put into (or took out of) the bank.
 *
 * Called when a payment is rejected after approval, or when a transaction is
 * deleted. It reads the live history rows and posts their exact negation, so it
 * works for money in and money out alike without knowing which it was, and a
 * second call is a no-op because the rows now net to zero.
 *
 * The original rows are deliberately left in place: they record something that
 * really happened, and the compensating entry is the honest way to undo money.
 *
 * Returns the total amount reversed.
 */
export async function reverseBankPostings(
	tx: Tx,
	transactionId: number,
	reason: string,
	userId?: string
): Promise<number> {
	const rows = await tx
		.select({
			bankAmountId: bankInsertHistory.bankAmountId,
			amount: bankInsertHistory.amount
		})
		.from(bankInsertHistory)
		.where(and(eq(bankInsertHistory.transactionId, transactionId), notDeleted(bankInsertHistory)));

	// Net per bank account, so a transaction posted and re-posted collapses into
	// one compensating entry instead of a pile of them.
	const netByBank = new Map<number, number>();
	for (const row of rows) {
		if (row.bankAmountId === null) continue;
		netByBank.set(row.bankAmountId, (netByBank.get(row.bankAmountId) ?? 0) + Number(row.amount));
	}

	let reversed = 0;
	for (const [bankAmountId, net] of netByBank) {
		if (!net) continue;
		await postToBank(tx, { bankAmountId, transactionId, amount: -net, reason, userId });
		reversed += net;
	}

	return reversed;
}

/** Current balance of a bank account, or `null` if there is no such account. */
export async function bankBalance(bankAmountId: number): Promise<number | null> {
	const [row] = await db
		.select({ amount: bankAmount.amount })
		.from(bankAmount)
		.where(and(eq(bankAmount.id, bankAmountId), notDeleted(bankAmount)))
		.limit(1);

	return row ? Number(row.amount) : null;
}

export type OverdraftCheck = {
	/** Balance before the movement. */
	balance: number;
	/** Balance the movement would leave behind. */
	projected: number;
	/** True when the movement takes the account below zero. */
	overdraws: boolean;
	/** How far below zero, as a positive number. Zero when it does not overdraw. */
	shortfall: number;
};

/**
 * Works out whether a movement would take an account below zero.
 *
 * This is deliberately advisory. These balances are a bookkeeping aid, not a
 * link to a real bank, so the app cannot actually know the money is not there —
 * refusing outright would block legitimate corrections and back-dated entries.
 * Callers warn, ask the user to accept the risk, and then go ahead.
 *
 * Read outside the write transaction, so a concurrent movement could change the
 * balance in between. That is acceptable for a warning; it is not a lock.
 */
export async function overdraftCheck(
	bankAmountId: number,
	/** Signed, same convention as `postToBank`. */
	amount: number
): Promise<OverdraftCheck | null> {
	const balance = await bankBalance(bankAmountId);
	if (balance === null) return null;

	const projected = balance + amount;

	return {
		balance,
		projected,
		overdraws: projected < 0,
		shortfall: projected < 0 ? Math.abs(projected) : 0
	};
}

/** The message every overdraft warning uses, so the wording stays consistent. */
export function overdraftMessage(check: OverdraftCheck): string {
	return (
		`This would take the account to ${check.projected.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} — ` +
		`${check.shortfall.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} more than the ` +
		`${check.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} recorded. ` +
		`Tick "I understand the risks" to record it anyway.`
	);
}
