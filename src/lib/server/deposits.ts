/**
 * Deposits: money a patient pays before there is a bill for it, and putting it towards their bills
 * later. A deposit is an ordinary payment — receipted, through the drawer when cash, its reference
 * checked like any transfer (`payments.ts`'s helpers) — with a `patient_deposit` row saying whose it
 * is. Applying it writes `invoice_payment` rows against the same transaction, so:
 *
 *   - a bill paid from a deposit is paid like any other, and its status follows
 *   - what is left of a deposit is its amount less what has been applied — derived, never stored
 *   - the patient's balance (`patientBalance`) is unchanged by a deposit until it is applied; the
 *     credit is shown beside it, so nobody reads "owes 2,000" without "in credit 1,500"
 *
 * Credit is applied oldest deposit first, so a statement reads in the order the money came in.
 *
 * Non-goals: refunding an unapplied deposit (it goes through the refunds queue once one exists
 * for deposits; until then a manager voids and re-takes), and deposits from an employer or insurer.
 */
import { and, asc, eq, inArray, sql } from 'drizzle-orm';

import { db } from '$lib/server/db';
import { invoice, invoicePayment, patientDeposit, transactions } from '$lib/server/db/schema';
import { notDeleted } from '$lib/server/softDelete';
import { recordAudit, type AuditRequest } from '$lib/server/audit';
import { refuseUnless } from '$lib/server/childCrud';
import { billingRefusals } from '$lib/server/cashDrawer';
import { billFor } from '$lib/server/billing';
import {
	insertPayment,
	methodFor,
	paidOn,
	referenceColumns,
	type OnlineConfirmation
} from '$lib/server/payments';
import { nextNumber } from '$lib/server/documentNumbers';
import { insertReturningId } from '@nahu/admin-kit/server/db/insert.js';
import { clinicToday } from '$lib/clinicTime';
import { canPay, cents, statusAfterPayment } from '$lib/invoiceStatus';

/** A transaction on the database, as `db.transaction` hands it over. */
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Reader = typeof db | Tx;

/** A patient's deposits, oldest first, each with what is left of it. */
export async function patientDeposits(patientId: number, reader: Reader = db) {
	const deposits = await reader
		.select({
			id: patientDeposit.id,
			transactionId: patientDeposit.transactionId,
			note: patientDeposit.note,
			amount: transactions.amount,
			receiptNumber: transactions.receiptNumber,
			takenOn: transactions.occurredOn,
			createdAt: transactions.createdAt
		})
		.from(patientDeposit)
		.innerJoin(
			transactions,
			and(
				eq(transactions.id, patientDeposit.transactionId),
				eq(transactions.approvalStatus, 'approved'),
				notDeleted(transactions)
			)
		)
		.where(and(eq(patientDeposit.patientId, patientId), notDeleted(patientDeposit)))
		.orderBy(asc(transactions.createdAt), asc(patientDeposit.id));
	if (!deposits.length) return [];
	const applied = await reader
		.select({
			transactionId: invoicePayment.transactionId,
			total: sql<number>`COALESCE(SUM(${invoicePayment.amount}), 0)`.mapWith(Number)
		})
		.from(invoicePayment)
		.where(
			and(
				inArray(
					invoicePayment.transactionId,
					deposits.map((d) => d.transactionId)
				),
				notDeleted(invoicePayment)
			)
		)
		.groupBy(invoicePayment.transactionId);
	const used = new Map(applied.map((a) => [a.transactionId, a.total]));
	return deposits.map((d) => ({
		...d,
		left: cents(d.amount - (used.get(d.transactionId) ?? 0))
	}));
}

/** What a patient has in credit: the unapplied part of their deposits. */
export async function patientCredit(patientId: number, reader: Reader = db): Promise<number> {
	const deposits = await patientDeposits(patientId, reader);
	return cents(deposits.reduce((sum, d) => sum + d.left, 0));
}

/** Takes a deposit. Returns the payment's id, for its receipt. */
export async function takeDeposit(
	tx: Tx,
	event: AuditRequest,
	input: {
		patientId: number;
		amount: number;
		paymentMethodId: number;
		branchId: number | null;
		reference: string | null;
		note: string | null;
		/** Set when a gateway confirmed it — the part of an online payment its bills no longer owed. */
		online?: OnlineConfirmation;
	}
): Promise<number> {
	const say = billingRefusals(event);
	const amount = cents(input.amount);
	refuseUnless(amount > 0, say.enterAmount, 'amount');
	const { method, cashSessionId } = await methodFor(tx, say, input.paymentMethodId, input.branchId);
	const references = await referenceColumns(tx, say, method.kind, input.reference, input.online);
	const transactionId = await insertPayment(tx, say, {
		description: `Deposit${input.note ? `: ${input.note}` : ''}`.slice(0, 255),
		direction: 'in',
		amount,
		paymentStatus: 'paid',
		paymentMethodId: method.id,
		patientId: input.patientId,
		occurredOn: clinicToday(),
		receiptNumber: await nextNumber(tx, 'receipt'),
		...references,
		cashSessionId,
		approvalStatus: 'approved',
		branchId: input.branchId ?? undefined,
		createdBy: event.locals.user?.id
	});
	await recordAudit(tx, event, {
		table: 'transactions',
		recordId: transactionId,
		action: 'create'
	});
	const depositId = await insertReturningId(tx, patientDeposit, {
		patientId: input.patientId,
		transactionId,
		note: input.note,
		createdBy: event.locals.user?.id
	});
	await recordAudit(tx, event, { table: 'patient_deposit', recordId: depositId, action: 'create' });
	return transactionId;
}

/**
 * Puts a patient's credit towards one of their bills: as much as the bill owes or the credit holds,
 * whichever is less, from the oldest deposit first. Returns what was applied.
 */
export async function applyCredit(
	tx: Tx,
	event: AuditRequest,
	patientId: number,
	invoiceId: number
): Promise<number> {
	const say = billingRefusals(event);
	const bill = await billFor(tx, patientId, invoiceId);
	refuseUnless(
		canPay(bill.status, bill.approvalStatus),
		bill.approvalStatus === 'pending'
			? say.billWaiting(bill.invoiceNumber ?? '')
			: say.billCannotPay(bill.invoiceNumber ?? '')
	);
	refuseUnless(bill.customerId === null, 'A deposit pays the patient’s own bills, not a payer’s.');
	const paid = await paidOn(tx, bill.id);
	let owed = cents(bill.total - paid);
	refuseUnless(owed > 0, 'This bill is paid.');

	// Locked so two desks applying the same credit at once cannot spend it twice.
	const locked = await tx
		.select({ id: patientDeposit.id })
		.from(patientDeposit)
		.where(and(eq(patientDeposit.patientId, patientId), notDeleted(patientDeposit)))
		.for('update');
	refuseUnless(locked.length > 0, 'This patient has no deposit.');
	const deposits = (await patientDeposits(patientId, tx)).filter((d) => d.left > 0);
	refuseUnless(deposits.length > 0, 'This patient has no credit left.');

	let applied = 0;
	const allocations: Record<number, number> = {};
	for (const d of deposits) {
		if (owed <= 0) break;
		const share = cents(Math.min(d.left, owed));
		await tx.insert(invoicePayment).values({
			invoiceId: bill.id,
			transactionId: d.transactionId,
			amount: share,
			createdBy: event.locals.user?.id
		});
		allocations[d.transactionId] = share;
		applied = cents(applied + share);
		owed = cents(owed - share);
	}
	const status = statusAfterPayment(bill.total, paid + applied);
	if (status !== bill.status) {
		await tx
			.update(invoice)
			.set({ status, updatedBy: event.locals.user?.id })
			.where(eq(invoice.id, bill.id));
	}
	await recordAudit(tx, event, {
		table: 'invoice_payment',
		recordId: bill.id,
		action: 'create',
		detail: { fromDeposits: allocations }
	});
	return applied;
}
