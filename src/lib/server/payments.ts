/**
 * Money in against bills, and money back out as refunds.
 *
 * **One payment, many bills; many payments, one bill.** A payment is one `transactions` row (money
 * in) and one `invoice_payment` row per bill it settles — a crown paid off over three months is
 * three payments on one bill, and settling two visits at once is one payment on two. A patient
 * pays their own bills (`takePayment`); an employer or insurer pays the bills billed to it, across
 * patients (`takePayerPayment`). Each bill's status follows from what it has had paid.
 *
 * **What a bill has been paid counts approved money only** (`paidOn`). A payment is approved when
 * it is taken; a refund is not, until a manager agrees.
 *
 * **A refund reverses part or all of one payment on one bill.** It is money out
 * (`reversesTransactionId` pointing at the payment) and a negative allocation on the bill, written
 * when it is asked for and waiting in the Refunds queue. It counts — against the bill, the
 * drawer and the payment — only once approved (`settleRefunds`), which is when it gets its number,
 * and when a cash refund comes out of the branch's open drawer.
 *
 * **Cash goes through the drawer.** A payment or refund by a method of kind `cash` needs the
 * branch's drawer open and is recorded against it (`server/cashDrawer.ts`).
 */
import { and, asc, eq, inArray, ne, sql } from 'drizzle-orm';

import { db } from '$lib/server/db';
import { invoice, invoicePayment, paymentMethods, transactions } from '$lib/server/db/schema';
import { notDeleted } from '$lib/server/softDelete';
import { WriteRefused, refuseUnless } from '$lib/server/childCrud';
import { recordAudit, type AuditRequest } from '$lib/server/audit';
import { insertReturningId } from '@nahu/admin-kit/server/db/insert.js';
import { nextNumber } from '$lib/server/documentNumbers';
import { isDuplicateKey } from '@nahu/admin-kit/server/dbErrors.js';
import { asRequested } from '$lib/server/approvals';
import { billFor } from '$lib/server/billing';
import { billingRefusals, openSessionFor } from '$lib/server/cashDrawer';
import { clinicToday } from '$lib/clinicTime';
import { canPay, cents, statusAfterPayment } from '$lib/invoiceStatus';

/** A transaction on the database, as `db.transaction` hands it over. */
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** The database, or a transaction on it. */
type Reader = typeof db | Tx;

/** A bill as the table holds it. */
type Bill = typeof invoice.$inferSelect;

/**
 * What a bill has been paid, net: payments in, less refunds out — approved money only, so a
 * refund waiting for a manager does not yet free anything up and a refused one never does.
 */
export async function paidOn(reader: Reader, invoiceId: number): Promise<number> {
	const [row] = await reader
		.select({ paid: sql<number>`COALESCE(SUM(${invoicePayment.amount}), 0)` })
		.from(invoicePayment)
		.innerJoin(
			transactions,
			and(
				eq(transactions.id, invoicePayment.transactionId),
				eq(transactions.approvalStatus, 'approved'),
				notDeleted(transactions)
			)
		)
		.where(and(eq(invoicePayment.invoiceId, invoiceId), notDeleted(invoicePayment)));
	return cents(Number(row?.paid ?? 0));
}

/**
 * A transfer's reference as it is matched: spaces dropped and upper case, so "bx 1234" typed at the
 * desk and "BX1234" on the statement are the same transfer.
 */
export function normalReference(reference: string | null | undefined): string | null {
	const cleaned = (reference ?? '').replace(/\s+/g, '').toUpperCase().slice(0, 128);
	return cleaned || null;
}

/**
 * The reference a payment by this method must or may carry, checked against every payment already
 * taken. Mobile money must have one — it is how the payment is found on the provider's statement,
 * and the only thing that tells two transfers of the same amount apart. A bank transfer may. Either
 * way a reference already recorded is refused: the same transfer cannot pay twice. The unique index
 * on `gateway_txn_token` is what actually guarantees that; this check only gives the reason.
 */
async function referenceFor(
	tx: Tx,
	say: ReturnType<typeof billingRefusals>,
	kind: string,
	reference: string | null
): Promise<string | null> {
	const token = normalReference(reference);
	if (kind === 'mobile') refuseUnless(token !== null, say.referenceRequired, 'reference');
	if (token === null || (kind !== 'mobile' && kind !== 'bank')) return null;
	const [taken] = await tx
		.select({ receipt: transactions.receiptNumber })
		.from(transactions)
		.where(eq(transactions.gatewayTxnToken, token))
		.limit(1);
	refuseUnless(!taken, say.referenceUsed(taken?.receipt ?? ''), 'reference');
	return token;
}

/** The method, and the open drawer when it is cash — refused when it is cash and there is none. */
async function methodFor(
	tx: Tx,
	say: ReturnType<typeof billingRefusals>,
	paymentMethodId: number,
	branchId: number | null
) {
	const [method] = await tx
		.select({ id: paymentMethods.id, kind: paymentMethods.kind })
		.from(paymentMethods)
		.where(and(eq(paymentMethods.id, paymentMethodId), notDeleted(paymentMethods)))
		.limit(1);
	if (!method) throw new WriteRefused('paymentMethodId', say.chooseMethod);
	if (method.kind !== 'cash') return { method, cashSessionId: null };

	const session = await openSessionFor(tx, branchId);
	if (!session) {
		throw new WriteRefused('paymentMethodId', say.drawerShut);
	}
	return { method, cashSessionId: session.id };
}

/**
 * Inserts the payment's transaction. Two desks entering the same reference at once both pass the
 * check in `referenceFor`; the unique index stops the second, and this turns that into the same
 * refusal rather than a 500.
 */
async function insertPayment(
	tx: Tx,
	say: ReturnType<typeof billingRefusals>,
	// `insertReturningId`'s own type: `occurredOn` is written as a clinic day string, which the
	// driver stores as given though the column's inferred type says `Date`.
	values: Record<string, unknown>
): Promise<number> {
	try {
		return await insertReturningId(tx, transactions, values);
	} catch (err: unknown) {
		if (isDuplicateKey(err)) throw new WriteRefused('reference', say.referenceUsed(''));
		throw err;
	}
}

/** The payment's shared body, once the caller has fetched and checked each bill it is for. */
async function recordPayment(
	tx: Tx,
	event: AuditRequest,
	input: {
		allocations: { invoiceId: number; amount: number }[];
		fetchBill: (invoiceId: number) => Promise<Bill>;
		patientId: number | null;
		customerId: number | null;
		paymentMethodId: number;
		branchId: number | null;
		reference: string | null;
	}
): Promise<number> {
	const allocations = input.allocations
		.map((a) => ({ invoiceId: a.invoiceId, amount: cents(a.amount) }))
		.filter((a) => a.amount > 0);
	const say = billingRefusals(event);
	refuseUnless(allocations.length > 0, say.enterAmount);
	refuseUnless(
		new Set(allocations.map((a) => a.invoiceId)).size === allocations.length,
		say.billTwice
	);
	const { method, cashSessionId } = await methodFor(tx, say, input.paymentMethodId, input.branchId);
	const token = await referenceFor(tx, say, method.kind, input.reference);

	// Each bill: the right owner's, payable, and not over-paid by this allocation.
	const checked: { amount: number; bill: Bill; paid: number }[] = [];
	for (const a of allocations) {
		const bill = await input.fetchBill(a.invoiceId);
		refuseUnless(
			canPay(bill.status, bill.approvalStatus),
			bill.approvalStatus === 'pending'
				? say.billWaiting(bill.invoiceNumber ?? '')
				: say.billCannotPay(bill.invoiceNumber ?? '')
		);
		const paid = await paidOn(tx, bill.id);
		const owed = cents(bill.total - paid);
		refuseUnless(a.amount <= owed + 0.005, say.moreThanOwed(bill.invoiceNumber ?? '', owed));
		checked.push({ amount: a.amount, bill, paid });
	}

	const amount = cents(allocations.reduce((sum, a) => sum + a.amount, 0));
	const transactionId = await insertPayment(tx, say, {
		description: `Payment for ${allocations.length === 1 ? 'bill' : `${allocations.length} bills`}`,
		direction: 'in',
		amount,
		paymentStatus: 'paid',
		paymentMethodId: method.id,
		patientId: input.patientId,
		customerId: input.customerId,
		occurredOn: clinicToday(),
		receiptNumber: await nextNumber(tx, 'receipt'),
		gatewayReference: input.reference?.trim().slice(0, 128) || null,
		gatewayTxnToken: token,
		cashSessionId,
		// Money in is not queued; only refunds are (see `APPROVAL_ENTITIES`).
		approvalStatus: 'approved',
		branchId: input.branchId ?? undefined,
		createdBy: event.locals.user?.id
	});
	await recordAudit(tx, event, {
		table: 'transactions',
		recordId: transactionId,
		action: 'create'
	});

	for (const { amount: share, bill, paid } of checked) {
		await tx.insert(invoicePayment).values({
			invoiceId: bill.id,
			transactionId,
			amount: share,
			createdBy: event.locals.user?.id
		});
		const status = statusAfterPayment(bill.total, paid + share);
		if (status !== bill.status) {
			await tx
				.update(invoice)
				.set({ status, updatedBy: event.locals.user?.id })
				.where(eq(invoice.id, bill.id));
		}
	}
	// One audit row for the allocation as a whole, not one per bill (§11: log the operation).
	await recordAudit(tx, event, {
		table: 'invoice_payment',
		recordId: transactionId,
		action: 'create',
		detail: { allocations: Object.fromEntries(allocations.map((a) => [a.invoiceId, a.amount])) }
	});
	return transactionId;
}

/** A patient pays one or more of their own bills. Returns the payment's id, for its receipt. */
export async function takePayment(
	tx: Tx,
	event: AuditRequest,
	input: {
		patientId: number;
		allocations: { invoiceId: number; amount: number }[];
		paymentMethodId: number;
		branchId: number | null;
		reference: string | null;
	}
): Promise<number> {
	return recordPayment(tx, event, {
		...input,
		customerId: null,
		fetchBill: (invoiceId) => billFor(tx, input.patientId, invoiceId)
	});
}

/** One of the payer's bills, locked, or a refusal — the payer-side twin of `billFor`. */
async function payerBill(
	tx: Tx,
	customerId: number,
	invoiceId: number,
	missing: string
): Promise<Bill> {
	const [row] = await tx
		.select()
		.from(invoice)
		.where(and(eq(invoice.id, invoiceId), eq(invoice.customerId, customerId), notDeleted(invoice)))
		.limit(1)
		.for('update');
	if (!row) throw new WriteRefused(null, missing);
	return row;
}

/**
 * An employer or insurer pays bills billed to it — any of its patients', in one payment. The
 * money is the payer's (`customerId`), not any one patient's.
 */
export async function takePayerPayment(
	tx: Tx,
	event: AuditRequest,
	input: {
		customerId: number;
		allocations: { invoiceId: number; amount: number }[];
		paymentMethodId: number;
		branchId: number | null;
		reference: string | null;
	}
): Promise<number> {
	return recordPayment(tx, event, {
		...input,
		patientId: null,
		fetchBill: (invoiceId) =>
			payerBill(tx, input.customerId, invoiceId, billingRefusals(event).notPayersBill)
	});
}

/* ── Refunds ───────────────────────────────────────────────────────────────────────────────── */

/**
 * How much of one payment on one bill can still be refunded: what it allocated to the bill, less
 * refunds of it already approved or still waiting. A waiting refund holds its amount, so two
 * requests cannot together refund more than was paid.
 */
async function refundable(
	tx: Tx,
	invoiceId: number,
	paymentId: number,
	missing: string
): Promise<number> {
	const [paidRow] = await tx
		.select({ amount: invoicePayment.amount })
		.from(invoicePayment)
		.innerJoin(
			transactions,
			and(
				eq(transactions.id, invoicePayment.transactionId),
				eq(transactions.direction, 'in'),
				eq(transactions.approvalStatus, 'approved'),
				notDeleted(transactions)
			)
		)
		.where(
			and(
				eq(invoicePayment.invoiceId, invoiceId),
				eq(invoicePayment.transactionId, paymentId),
				notDeleted(invoicePayment)
			)
		)
		.limit(1);
	if (!paidRow) throw new WriteRefused(null, missing);

	const [refunded] = await tx
		.select({ amount: sql<number>`COALESCE(SUM(-${invoicePayment.amount}), 0)` })
		.from(invoicePayment)
		.innerJoin(
			transactions,
			and(
				eq(transactions.id, invoicePayment.transactionId),
				eq(transactions.reversesTransactionId, paymentId),
				ne(transactions.approvalStatus, 'rejected'),
				notDeleted(transactions)
			)
		)
		.where(and(eq(invoicePayment.invoiceId, invoiceId), notDeleted(invoicePayment)));
	return cents(paidRow.amount - Number(refunded?.amount ?? 0));
}

/**
 * Asks for part or all of one payment on one of the patient's bills to be given back. Nothing moves
 * until a manager approves it in Approvals → Refunds. Returns the refund's id.
 */
export async function requestRefund(
	tx: Tx,
	event: AuditRequest,
	input: {
		patientId: number;
		invoiceId: number;
		paymentId: number;
		amount: number;
		paymentMethodId: number;
		reason: string;
		branchId: number | null;
	}
): Promise<number> {
	const say = billingRefusals(event);
	const bill = await billFor(tx, input.patientId, input.invoiceId);
	refuseUnless(bill.status !== 'draft' && bill.status !== 'void', say.nothingToRefund);
	const amount = cents(input.amount);
	refuseUnless(amount > 0, say.enterRefund, 'amount');
	const available = await refundable(tx, bill.id, input.paymentId, say.paymentNotOnBill);
	refuseUnless(
		amount <= available + 0.005,
		available > 0 ? say.atMost(available) : say.refundedAlready,
		'amount'
	);
	const why = input.reason.trim();
	refuseUnless(why.length > 0, say.sayWhyRefund, 'reason');

	// Checked now so the desk knows; checked again at approval, when the cash actually leaves.
	const [method] = await tx
		.select({ id: paymentMethods.id })
		.from(paymentMethods)
		.where(and(eq(paymentMethods.id, input.paymentMethodId), notDeleted(paymentMethods)))
		.limit(1);
	if (!method) throw new WriteRefused('paymentMethodId', say.chooseRefundMethod);

	const refundId = await insertReturningId(tx, transactions, {
		description: `Refund on bill ${bill.invoiceNumber ?? ''}: ${why}`.slice(0, 255),
		direction: 'out',
		amount,
		paymentStatus: 'pending',
		paymentMethodId: method.id,
		patientId: bill.patientId,
		customerId: bill.customerId,
		occurredOn: clinicToday(),
		reversesTransactionId: input.paymentId,
		...asRequested(event.locals.user?.id),
		branchId: input.branchId ?? undefined,
		createdBy: event.locals.user?.id
	});
	// The negative allocation that will reduce the bill — counted only once the refund is approved.
	await tx.insert(invoicePayment).values({
		invoiceId: bill.id,
		transactionId: refundId,
		amount: -amount,
		createdBy: event.locals.user?.id
	});
	await recordAudit(tx, event, {
		table: 'transactions',
		recordId: refundId,
		action: 'create',
		detail: { refundOf: input.paymentId, invoiceId: bill.id, amount, reason: why }
	});
	return refundId;
}

/**
 * What a manager's decision in the Refunds queue does, in the settling transaction. The queue sets
 * `approvalStatus`; this does the rest of an approval:
 *
 *   - numbers the refund (`RFD-…`) and marks it paid out, today
 *   - a cash refund comes out of the branch's open drawer — refused if none is open, since the
 *     drawer count would otherwise not know the cash left it
 *   - the bill's status is worked out again from what it has now been paid, net
 *   - the payment it reverses is marked refunded, in part or in full
 *
 * A refused refund needs nothing: its allocation never counts, because its money was never
 * approved.
 */
export async function settleRefunds(
	ids: number[],
	decision: 'approved' | 'rejected',
	database: Reader
) {
	if (decision !== 'approved' || !ids.length) return;
	const refunds = await database
		.select({
			id: transactions.id,
			branchId: transactions.branchId,
			reverses: transactions.reversesTransactionId,
			kind: paymentMethods.kind
		})
		.from(transactions)
		.leftJoin(paymentMethods, eq(paymentMethods.id, transactions.paymentMethodId))
		.where(and(inArray(transactions.id, ids), eq(transactions.direction, 'out')));

	for (const refund of refunds) {
		let cashSessionId: number | null = null;
		if (refund.kind === 'cash') {
			const session = await openSessionFor(database, refund.branchId);
			if (!session) {
				throw new WriteRefused(
					null,
					'A cash refund comes out of the drawer: open the cash drawer at that branch, then approve it.'
				);
			}
			cashSessionId = session.id;
		}
		await database
			.update(transactions)
			.set({
				paymentStatus: 'paid',
				// The clinic's day, as the `Date`-mode column takes it: its UTC midnight.
				occurredOn: new Date(`${clinicToday()}T00:00:00Z`),
				cashSessionId,
				// A number only for money that actually went back.
				receiptNumber: await nextNumber(database, 'refund')
			})
			.where(eq(transactions.id, refund.id));

		const allocations = await database
			.select({ invoiceId: invoicePayment.invoiceId })
			.from(invoicePayment)
			.where(and(eq(invoicePayment.transactionId, refund.id), notDeleted(invoicePayment)));
		for (const { invoiceId } of allocations) {
			const [bill] = await database
				.select({ total: invoice.total, status: invoice.status })
				.from(invoice)
				.where(eq(invoice.id, invoiceId));
			if (!bill || bill.status === 'void' || bill.status === 'draft') continue;
			const status = statusAfterPayment(bill.total, await paidOn(database, invoiceId));
			if (status !== bill.status) {
				await database.update(invoice).set({ status }).where(eq(invoice.id, invoiceId));
			}
		}

		if (refund.reverses) {
			const [original] = await database
				.select({ amount: transactions.amount })
				.from(transactions)
				.where(eq(transactions.id, refund.reverses));
			const [back] = await database
				.select({ total: sql<number>`COALESCE(SUM(${transactions.amount}), 0)` })
				.from(transactions)
				.where(
					and(
						eq(transactions.reversesTransactionId, refund.reverses),
						eq(transactions.approvalStatus, 'approved'),
						notDeleted(transactions)
					)
				);
			if (original) {
				await database
					.update(transactions)
					.set({
						paymentStatus:
							Number(back?.total ?? 0) + 0.005 >= original.amount
								? 'refunded'
								: 'partially_refunded'
					})
					.where(eq(transactions.id, refund.reverses));
			}
		}
	}
}

/**
 * The payment methods a desk can take, with what kind each is — the form marks cash, which needs
 * the drawer open.
 */
export async function paymentMethodOptions() {
	return db
		.select({ value: paymentMethods.id, name: paymentMethods.name, kind: paymentMethods.kind })
		.from(paymentMethods)
		.where(and(eq(paymentMethods.isActive, true), notDeleted(paymentMethods)))
		.orderBy(asc(paymentMethods.name));
}
