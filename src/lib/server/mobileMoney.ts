/**
 * Checking the money that arrived through a phone or a bank against the provider's own statement.
 *
 * Cash has a drawer, and the drawer is counted (`server/cashDrawer.ts`). A Telebirr or CBE Birr
 * payment has none: the desk records it from the patient's confirmation message, and nothing says
 * the money arrived until someone opens the merchant statement and finds it. This is that check —
 * a day's transfers at the branch, each ticked when it is found (`transactions.reconciledAt`), with
 * what is still unticked totalled so a short day shows.
 *
 * The reference is the match. A mobile payment cannot be taken without one, and the same one cannot
 * be taken twice (`referenceFor` in `server/payments.ts`), so each line here is one transfer the
 * statement should show once.
 *
 * Non-goals: importing the statement. Telebirr's and CBE Birr's merchant exports differ and change,
 * and a wrong automatic match is worse than a person ticking; and refunds, which leave through the
 * approvals queue and are checked there.
 */
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/mysql-core';

import { db } from '$lib/server/db';
import { customers, patient, paymentMethods, transactions, user } from '$lib/server/db/schema';
import { notDeleted } from '$lib/server/softDelete';
import { branchFilter, type BranchContext } from '$lib/server/branchScope';
import { recordAudit, type AuditRequest } from '$lib/server/audit';
import { refuseUnless } from '$lib/server/childCrud';
import { patientFullName } from '$lib/server/patients';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
/** The database or a transaction on it — a test reads its own rollback. */
type Reader = typeof db | Tx;

/** Ticking a transfer as found is counting money, the same standing as closing the drawer. */
export const RECONCILE_PERMISSION = 'billing.cash_session';

/** The kinds of money that arrive with a reference and no drawer. */
const TRANSFER_KINDS = ['mobile', 'bank'] as const;

/** Who ticked it — an attribution join, so a deleted user still shows (CLAUDE.md §9). */
const checker = alias(user, 'reconciled_by_user');

/** A day's transfers in at the working branch, earliest first. */
export async function transfersOn(
	branch: Pick<BranchContext, 'active'>,
	day: string,
	reader: Reader = db
) {
	return reader
		.select({
			id: transactions.id,
			at: transactions.createdAt,
			receipt: transactions.receiptNumber,
			amount: transactions.amount,
			method: paymentMethods.name,
			kind: paymentMethods.kind,
			reference: transactions.gatewayReference,
			patientId: transactions.patientId,
			patient: patientFullName,
			payer: customers.name,
			reconciledAt: transactions.reconciledAt,
			reconciledBy: checker.name
		})
		.from(transactions)
		.innerJoin(paymentMethods, eq(paymentMethods.id, transactions.paymentMethodId))
		.leftJoin(patient, eq(patient.id, transactions.patientId))
		.leftJoin(customers, eq(customers.id, transactions.customerId))
		.leftJoin(checker, eq(checker.id, transactions.reconciledBy))
		.where(
			and(
				eq(transactions.direction, 'in'),
				eq(transactions.approvalStatus, 'approved'),
				inArray(paymentMethods.kind, [...TRANSFER_KINDS]),
				eq(transactions.occurredOn, sql`${day}`),
				notDeleted(transactions),
				branchFilter(transactions.branchId, branch)
			)
		)
		.orderBy(asc(transactions.createdAt));
}

/** One line per method: how many, how much, and how much of it is still unticked. */
export function transferTotals(rows: Awaited<ReturnType<typeof transfersOn>>) {
	const byMethod = new Map<
		string,
		{ method: string; count: number; total: number; unchecked: number }
	>();
	for (const row of rows) {
		const line = byMethod.get(row.method) ?? {
			method: row.method,
			count: 0,
			total: 0,
			unchecked: 0
		};
		line.count++;
		line.total += row.amount;
		if (!row.reconciledAt) line.unchecked += row.amount;
		byMethod.set(row.method, line);
	}
	return [...byMethod.values()].map((l) => ({
		...l,
		total: Math.round(l.total * 100) / 100,
		unchecked: Math.round(l.unchecked * 100) / 100
	}));
}

/**
 * Ticks a transfer as found on the statement, or takes the tick off, audited. Only a transfer in at
 * the working branch: an id from another branch, or a cash payment, is refused.
 */
export async function setReconciled(
	tx: Tx,
	event: AuditRequest & { locals: { branch: Pick<BranchContext, 'active'> } },
	transactionId: number,
	found: boolean,
	refusals: { notHere: string }
): Promise<void> {
	const [row] = await tx
		.select({
			id: transactions.id,
			reconciledAt: transactions.reconciledAt,
			reconciledBy: transactions.reconciledBy
		})
		.from(transactions)
		.innerJoin(paymentMethods, eq(paymentMethods.id, transactions.paymentMethodId))
		.where(
			and(
				eq(transactions.id, transactionId),
				eq(transactions.direction, 'in'),
				inArray(paymentMethods.kind, [...TRANSFER_KINDS]),
				notDeleted(transactions),
				branchFilter(transactions.branchId, event.locals.branch)
			)
		)
		.limit(1)
		.for('update');
	refuseUnless(Boolean(row), refusals.notHere);

	const after = found
		? {
				reconciledAt: row.reconciledAt ?? new Date(),
				reconciledBy: row.reconciledBy ?? event.locals.user?.id ?? null
			}
		: { reconciledAt: null, reconciledBy: null };
	await tx.update(transactions).set(after).where(eq(transactions.id, row.id));
	await recordAudit(tx, event, {
		table: 'transactions',
		recordId: row.id,
		action: 'update',
		before: row,
		after
	});
}
