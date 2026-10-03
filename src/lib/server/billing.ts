/**
 * Billing, read side: what a patient has been billed, what they still owe, and what work is not yet
 * on a bill — every query the billing screens share. The writes are `invoiceWrites.ts` (the bill)
 * and `payments.ts` (the money).
 *
 * **A bill is made from work done.** Its lines are the patient's *completed* procedures, each
 * **snapshotted** — description and price written onto the line — so re-pricing a service next
 * month cannot change a bill the patient is holding (`invoice_line`). A charge that is not
 * charted work (a missed-appointment fee, something sold) is a line typed onto a draft.
 *
 * **Issuing is the line in the sand.** A draft is workspace. Issuing numbers the bill from a
 * counter that cannot collide (`nextNumber`), freezes it, and decides whether its discount needs a
 * manager (`$lib/invoiceStatus.ts`). A bill waiting on a manager takes no payment.
 *
 * **What a bill owes is derived.** Its total less what has been allocated to it
 * (`invoice_payment`) — never a stored running figure (see `invoice`). Taking the money is
 * `server/payments.ts`; the drawer it goes into is `server/cashDrawer.ts`.
 *
 * Every write re-checks what the form claims — this patient's bill, in a status that allows the
 * step, work that is theirs and done and not already billed — refuses with a `WriteRefused`, and
 * is audited in its own transaction (CLAUDE.md §11).
 *
 * Non-goals:
 *   - **VAT.** Medical services are VAT-exempt in Ethiopia, so no bill here carries VAT. A clinic
 *     that sells taxable goods over the threshold is the day `vatAmount` gets written.
 *   - **Refunds.** A refund is money out, reversing a payment (`transactions.reversesTransactionId`),
 *     and goes through its own approvals queue. Not built yet; a paid bill cannot be voided until it is.
 *   - **Insurance claims.** A bill may name the employer or insurer paying (`customerId`); claiming
 *     from them is outside the app.
 */
import { and, asc, desc, eq, gt, inArray, isNull, ne, notInArray, sql } from 'drizzle-orm';

import { db } from '$lib/server/db';
import {
	appointment,
	customers,
	invoice,
	invoiceLine,
	invoicePayment,
	patient,
	paymentMethods,
	procedures,
	services,
	transactions
} from '$lib/server/db/schema';
import { notDeleted } from '$lib/server/softDelete';
import { WriteRefused } from '$lib/server/childCrud';
import { patientFullName } from '$lib/server/patients';
import { branchFilter, type BranchContext } from '$lib/server/branchScope';
import { whereLabel } from '$lib/teeth';
import { isoDate } from '$lib/server/db/dialect';
import { cents, type InvoiceStatus } from '$lib/invoiceStatus';
import { billTotals } from '$lib/billTax';
import { readSettings } from '$lib/server/settings';

/** A transaction on the database, as `db.transaction` hands it over. */
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** The database, or a transaction on it. */
type Reader = typeof db | Tx;

/* ── Reading ───────────────────────────────────────────────────────────────────────────────── */

/**
 * What has been paid on each bill, net of refunds, as a subquery on `invoiceId` — the same rule as
 * `paidOn` in `payments.ts`: approved money that was not deleted.
 */
function paidPerInvoice(reader: Reader = db) {
	return reader
		.select({
			invoiceId: invoicePayment.invoiceId,
			paid: sql<number>`COALESCE(SUM(${invoicePayment.amount}), 0)`.as('invoice_paid_total')
		})
		.from(invoicePayment)
		.innerJoin(
			transactions,
			// Approved money only: a refund waiting for a manager has not left yet (`payments.ts`).
			and(
				eq(transactions.id, invoicePayment.transactionId),
				eq(transactions.approvalStatus, 'approved'),
				notDeleted(transactions)
			)
		)
		.where(notDeleted(invoicePayment))
		.groupBy(invoicePayment.invoiceId)
		.as('invoice_paid');
}

/** A bill that is owed: issued (paid or not), not void, not deleted. Drafts are owed by nobody. */
const owedInvoice = () =>
	and(inArray(invoice.status, ['issued', 'partly', 'paid']), notDeleted(invoice));

/**
 * What one patient owes: the total of their issued bills less what has been paid against them.
 * The one definition of a balance — the chart header, the overview, the billing tab and the
 * receivables list all read it, so none can disagree.
 */
export async function patientBalance(patientId: number, reader: Reader = db): Promise<number> {
	const paid = paidPerInvoice(reader);
	const [row] = await reader
		.select({
			owed: sql<number>`COALESCE(SUM(${invoice.total} - COALESCE(${paid.paid}, 0)), 0)`
		})
		.from(invoice)
		.leftJoin(paid, eq(paid.invoiceId, invoice.id))
		.where(and(eq(invoice.patientId, patientId), owedInvoice()));
	return cents(Number(row?.owed ?? 0));
}

/**
 * The balances of many patients at once, for a list — one query, not one per row. Patients who owe
 * nothing are absent from the map.
 */
export async function balancesFor(patientIds: number[]): Promise<Map<number, number>> {
	if (!patientIds.length) return new Map();
	const paid = paidPerInvoice();
	const rows = await db
		.select({
			patientId: invoice.patientId,
			owed: sql<number>`SUM(${invoice.total} - COALESCE(${paid.paid}, 0))`
		})
		.from(invoice)
		.leftJoin(paid, eq(paid.invoiceId, invoice.id))
		.where(and(inArray(invoice.patientId, patientIds), owedInvoice()))
		.groupBy(invoice.patientId);
	const balances = new Map<number, number>();
	for (const row of rows) {
		const owed = cents(Number(row.owed ?? 0));
		if (owed > 0) balances.set(row.patientId, owed);
	}
	return balances;
}

/** A patient's bills, newest first, with what each has had paid and still owes. */
export async function patientInvoices(patientId: number) {
	const paid = paidPerInvoice();
	const rows = await db
		.select({
			id: invoice.id,
			invoiceNumber: invoice.invoiceNumber,
			status: invoice.status,
			approvalStatus: invoice.approvalStatus,
			issuedOn: invoice.issuedOn,
			appointmentId: invoice.appointmentId,
			total: invoice.total,
			discount: invoice.discount,
			paid: paid.paid,
			createdAt: invoice.createdAt
		})
		.from(invoice)
		.leftJoin(paid, eq(paid.invoiceId, invoice.id))
		.where(and(eq(invoice.patientId, patientId), notDeleted(invoice)))
		.orderBy(desc(invoice.createdAt), desc(invoice.id));
	// A draft's total is only frozen when it is issued; until then it is its lines, less its discount.
	const drafts = rows.filter((r) => r.status === 'draft').map((r) => r.id);
	const draftTotals = new Map<number, number>();
	if (drafts.length) {
		const sums = await db
			.select({
				invoiceId: invoiceLine.invoiceId,
				total: sql<number>`COALESCE(SUM(${invoiceLine.lineTotal}), 0)`
			})
			.from(invoiceLine)
			.where(and(inArray(invoiceLine.invoiceId, drafts), notDeleted(invoiceLine)))
			.groupBy(invoiceLine.invoiceId);
		for (const s of sums) draftTotals.set(s.invoiceId, Number(s.total));
	}

	return rows.map((row) => {
		const paidTotal = cents(Number(row.paid ?? 0));
		const total =
			row.status === 'draft'
				? cents((draftTotals.get(row.id) ?? 0) - (row.discount ?? 0))
				: row.total;
		const owed = row.status === 'draft' || row.status === 'void' ? 0 : cents(total - paidTotal);
		return { ...row, total, paid: paidTotal, owed };
	});
}

/** One row of `patientInvoices`. */
export type InvoiceRow = Awaited<ReturnType<typeof patientInvoices>>[number];

/**
 * The patient's completed work not yet on a live bill — what a new bill can be raised from — with
 * the visit each piece was done at, so the desk can bill a visit at a time. Work already on a draft
 * counts as billed: it is on its way to a bill, and billing it twice is the mistake to prevent.
 */
export async function unbilledWork(patientId: number, reader: Reader = db) {
	const billed = reader
		.select({ id: sql<number>`${invoiceLine.procedureId}` })
		.from(invoiceLine)
		.innerJoin(
			invoice,
			and(eq(invoice.id, invoiceLine.invoiceId), notDeleted(invoice), ne(invoice.status, 'void'))
		)
		.where(
			and(
				eq(invoice.patientId, patientId),
				notDeleted(invoiceLine),
				sql`${invoiceLine.procedureId} IS NOT NULL`
			)
		);

	const rows = await reader
		.select({
			id: procedures.id,
			// For the prepaid-package check when the work is billed (`packageCover.ts`).
			serviceId: procedures.serviceId,
			service: services.name,
			area: services.area,
			toothId: procedures.toothId,
			surfaces: procedures.surfaces,
			toothRange: procedures.toothRange,
			fee: procedures.fee,
			completedOn: procedures.completedOn,
			appointmentId: procedures.appointmentId,
			providerId: procedures.providerId,
			visitAt: appointment.startsAt
		})
		.from(procedures)
		.leftJoin(services, eq(services.id, procedures.serviceId))
		.leftJoin(
			appointment,
			and(eq(appointment.id, procedures.appointmentId), notDeleted(appointment))
		)
		.where(
			and(
				eq(procedures.patientId, patientId),
				eq(procedures.status, 'completed'),
				gt(procedures.fee, 0),
				notDeleted(procedures),
				notInArray(procedures.id, billed)
			)
		)
		.orderBy(desc(procedures.completedOn), asc(procedures.id));

	return rows.map((row) => ({
		...row,
		fee: row.fee ?? 0,
		where: whereLabel(row),
		description: lineDescription(row.service, row.area, whereLabel(row))
	}));
}

/** One row of `unbilledWork`. */
export type UnbilledWork = Awaited<ReturnType<typeof unbilledWork>>[number];

/** A bill line's words for charted work: the service, and where on the mouth when it matters. */
function lineDescription(service: string | null, area: string | null, where: string): string {
	const name = service ?? 'Treatment';
	return (area === 'mouth' || where === 'Whole mouth' ? name : `${name} — ${where}`).slice(0, 255);
}

/** One bill of this patient's with its lines and payments, or null when it is not theirs. */
/** The clinic's VAT standing now, for a draft's preview. */
async function vatStanding() {
	const settings = await readSettings();
	return { registered: settings.vatRegistered, rate: settings.vatRate };
}

export async function invoiceDetail(patientId: number, invoiceId: number) {
	const [bill] = await db
		.select()
		.from(invoice)
		.where(and(eq(invoice.id, invoiceId), eq(invoice.patientId, patientId), notDeleted(invoice)))
		.limit(1);
	if (!bill) return null;

	const [lines, payments] = await Promise.all([
		db
			.select({
				id: invoiceLine.id,
				procedureId: invoiceLine.procedureId,
				description: invoiceLine.description,
				quantity: invoiceLine.quantity,
				unitPrice: invoiceLine.unitPrice,
				lineTotal: invoiceLine.lineTotal,
				taxable: invoiceLine.taxable
			})
			.from(invoiceLine)
			.where(and(eq(invoiceLine.invoiceId, invoiceId), notDeleted(invoiceLine)))
			.orderBy(asc(invoiceLine.sortOrder), asc(invoiceLine.id)),
		db
			.select({
				id: invoicePayment.id,
				amount: invoicePayment.amount,
				transactionId: transactions.id,
				// A refund is money out, and counts only once approved.
				direction: transactions.direction,
				approvalStatus: transactions.approvalStatus,
				reverses: transactions.reversesTransactionId,
				receiptNumber: transactions.receiptNumber,
				// As a calendar day: the column is in `Date` mode for the older screens that read it.
				occurredOn: isoDate(transactions.occurredOn),
				method: paymentMethods.name
			})
			.from(invoicePayment)
			.innerJoin(
				transactions,
				and(eq(transactions.id, invoicePayment.transactionId), notDeleted(transactions))
			)
			.leftJoin(paymentMethods, eq(paymentMethods.id, transactions.paymentMethodId))
			.where(and(eq(invoicePayment.invoiceId, invoiceId), notDeleted(invoicePayment)))
			.orderBy(asc(invoicePayment.id))
	]);

	// What of each payment could still be given back — a hint for the refund button. The rule that
	// counts is `refundable` in `server/payments.ts`, re-run under a lock when the refund is asked.
	const asked = (paymentId: number) =>
		payments
			.filter((p) => p.reverses === paymentId && p.approvalStatus !== 'rejected')
			.reduce((sum, p) => sum - p.amount, 0);
	const withRefundable = payments.map((p) => ({
		...p,
		refundable:
			p.direction === 'in' && p.approvalStatus === 'approved'
				? Math.max(0, cents(p.amount - asked(p.transactionId)))
				: 0
	}));

	const paid = cents(
		payments.filter((p) => p.approvalStatus === 'approved').reduce((sum, p) => sum + p.amount, 0)
	);
	/*
	 * A draft's figures are worked out live from its lines, VAT included, by the rule issuing will
	 * use (`$lib/billTax.ts`) — so what the patient is told is what the bill will say. An issued
	 * bill's are its own, as issued.
	 */
	const draft = bill.status === 'draft';
	const live = draft
		? billTotals(lines, bill.discount ?? 0, await vatStanding())
		: { subtotal: bill.subtotal, vat: bill.vatAmount, rate: bill.vatRate, total: bill.total };
	const total = live.total;
	return {
		...bill,
		lines,
		payments: withRefundable,
		subtotal: live.subtotal,
		vatAmount: live.vat,
		vatRate: live.rate,
		total,
		paid,
		owed: bill.status === 'draft' || bill.status === 'void' ? 0 : cents(total - paid)
	};
}

/** What `invoiceDetail` returns for a bill that exists. */
export type InvoiceDetail = NonNullable<Awaited<ReturnType<typeof invoiceDetail>>>;

/**
 * Patients at this branch who owe money, the most owed first — the receivables list. Scoped to the
 * branch the bills were raised at (`invoice` is in `BRANCH_SCOPED`). A bill billed to an employer
 * or insurer is theirs to chase, so it is in `payerReceivables` instead — not in both, or the desk
 * would count it twice and phone the patient for money their insurer owes.
 */
export async function receivables(branch: Pick<BranchContext, 'active'>) {
	const paid = paidPerInvoice();
	const rows = await db
		.select({
			patientId: invoice.patientId,
			patient: patientFullName,
			fileNo: patient.fileNo,
			phone: patient.phone,
			bills: sql<number>`COUNT(*)`,
			owed: sql<number>`SUM(${invoice.total} - COALESCE(${paid.paid}, 0))`,
			oldest: sql<string>`MIN(${invoice.issuedOn})`
		})
		.from(invoice)
		.innerJoin(patient, eq(patient.id, invoice.patientId))
		.leftJoin(paid, eq(paid.invoiceId, invoice.id))
		.where(
			and(
				inArray(invoice.status, ['issued', 'partly']),
				isNull(invoice.customerId),
				notDeleted(invoice),
				branchFilter(invoice.branchId, branch)
			)
		)
		.groupBy(invoice.patientId, patient.id)
		.orderBy(desc(sql`SUM(${invoice.total} - COALESCE(${paid.paid}, 0))`));
	return rows
		.map((r) => ({ ...r, bills: Number(r.bills), owed: cents(Number(r.owed ?? 0)) }))
		.filter((r) => r.owed > 0);
}

/**
 * Every bill at this branch with money still owing on it, one row each, oldest first — patients'
 * and payers' both, since an aging report is about the clinic's money, not who chases it. The
 * Who Owes lists group the same bills by debtor; this keeps the bill and its issue date, which is
 * what aging is counted from.
 */
export async function openBills(branch: Pick<BranchContext, 'active'>) {
	const paid = paidPerInvoice();
	const rows = await db
		.select({
			id: invoice.id,
			invoiceNumber: invoice.invoiceNumber,
			patientId: invoice.patientId,
			patient: patientFullName,
			payer: customers.name,
			issuedOn: invoice.issuedOn,
			dueOn: invoice.dueOn,
			total: invoice.total,
			paid: paid.paid
		})
		.from(invoice)
		.innerJoin(patient, eq(patient.id, invoice.patientId))
		.leftJoin(customers, eq(customers.id, invoice.customerId))
		.leftJoin(paid, eq(paid.invoiceId, invoice.id))
		.where(
			and(
				inArray(invoice.status, ['issued', 'partly']),
				notDeleted(invoice),
				branchFilter(invoice.branchId, branch)
			)
		)
		.orderBy(asc(invoice.issuedOn), asc(invoice.id));
	return rows
		.map((r) => ({ ...r, owed: cents(r.total - Number(r.paid ?? 0)) }))
		.filter((r) => r.owed > 0);
}

/**
 * The bills billed to one employer or insurer, across every patient, with what each still owes —
 * the payer's own account. Drafts are not shown: nothing is owed on them yet.
 */
export async function payerInvoices(customerId: number, reader: Reader = db) {
	const paid = paidPerInvoice(reader);
	const rows = await reader
		.select({
			id: invoice.id,
			patientId: invoice.patientId,
			patient: patientFullName,
			invoiceNumber: invoice.invoiceNumber,
			status: invoice.status,
			approvalStatus: invoice.approvalStatus,
			issuedOn: invoice.issuedOn,
			total: invoice.total,
			paid: paid.paid
		})
		.from(invoice)
		.innerJoin(patient, eq(patient.id, invoice.patientId))
		.leftJoin(paid, eq(paid.invoiceId, invoice.id))
		.where(
			and(eq(invoice.customerId, customerId), notDeleted(invoice), ne(invoice.status, 'draft'))
		)
		.orderBy(desc(invoice.issuedOn), desc(invoice.id));
	return rows.map((row) => {
		const paidTotal = cents(Number(row.paid ?? 0));
		return {
			...row,
			paid: paidTotal,
			owed: row.status === 'void' ? 0 : cents(row.total - paidTotal)
		};
	});
}

/**
 * Employers and insurers who owe the clinic, the most owed first — the payers' half of the
 * receivables list, and the bills `receivables` leaves out. They still count in the patient's own
 * balance on their chart: a patient's bill is theirs to see whoever is paying it.
 */
export async function payerReceivables(branch: Pick<BranchContext, 'active'>) {
	const paid = paidPerInvoice();
	const owedSum = sql<number>`SUM(${invoice.total} - COALESCE(${paid.paid}, 0))`;
	const rows = await db
		.select({
			customerId: customers.id,
			payer: customers.name,
			phone: customers.phone,
			bills: sql<number>`COUNT(*)`,
			owed: owedSum,
			oldest: sql<string>`MIN(${invoice.issuedOn})`
		})
		.from(invoice)
		.innerJoin(customers, eq(customers.id, invoice.customerId))
		.leftJoin(paid, eq(paid.invoiceId, invoice.id))
		.where(
			and(
				inArray(invoice.status, ['issued', 'partly']),
				notDeleted(invoice),
				branchFilter(invoice.branchId, branch)
			)
		)
		.groupBy(customers.id)
		.orderBy(desc(owedSum));
	return rows
		.map((r) => ({ ...r, bills: Number(r.bills), owed: cents(Number(r.owed ?? 0)) }))
		.filter((r) => r.owed > 0);
}

/* ── Shared with the writes ─────────────────────────────────────────────────────────────────── */

/**
 * The bill a write is about, re-read and locked in the write's transaction, and checked to be the
 * patient's. Locked so two payments against one bill cannot both see it unpaid.
 */
export async function billFor(tx: Tx, patientId: number, invoiceId: number) {
	const [row] = await tx
		.select()
		.from(invoice)
		.where(and(eq(invoice.id, invoiceId), eq(invoice.patientId, patientId), notDeleted(invoice)))
		.limit(1)
		.for('update');
	if (!row) throw new WriteRefused(null, 'That bill is not on this patient’s record.');
	return row;
}

/** The statuses, re-exported for pages that only need the type. */
export type { InvoiceStatus };
