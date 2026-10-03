/**
 * Billing, write side: raising a bill, changing a draft, issuing it, and asking for a void — plus
 * what a manager's decision on a discount or a void does to it.
 *
 * Every write re-checks what the form claims — this patient's bill, a status that allows the step
 * (`$lib/invoiceStatus.ts`), work that is theirs and done and not already billed — refuses with a
 * `WriteRefused`, and is audited in its own transaction (CLAUDE.md §11). The module header of
 * `billing.ts` says what a bill is; this one only changes them.
 */
import { and, eq, inArray, ne, sql } from 'drizzle-orm';

import { db } from '$lib/server/db';
import { customers, invoice, invoiceLine, patient } from '$lib/server/db/schema';
import { notDeleted, softDeleteDraftInvoice, softDeleteInvoiceLine } from '$lib/server/softDelete';
import { WriteRefused, refuseUnless } from '$lib/server/childCrud';
import { recordAudit, type AuditRequest } from '$lib/server/audit';
import { insertReturningId } from '@nahu/admin-kit/server/db/insert.js';
import { asRequested } from '$lib/server/approvals';
import { readSettings } from '$lib/server/settings';
import { nextNumber } from '$lib/server/documentNumbers';
import { billFor, unbilledWork } from '$lib/server/billing';
import { paidOn } from '$lib/server/payments';
import { billingRefusals } from '$lib/server/cashDrawer';
import { clinicToday } from '$lib/clinicTime';
import { canEditInvoice, canRequestVoid, cents, discountNeedsApproval } from '$lib/invoiceStatus';
import { billTotals, type BillTotals, type VatStanding } from '$lib/billTax';
import { applyCover, checkPreauth } from '$lib/server/payerCover';
import { coverageFor } from '$lib/server/packageCover';

/** A transaction on the database, as `db.transaction` hands it over. */
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** The database, or a transaction on it. */
type Reader = typeof db | Tx;

/**
 * A bill's totals from its live lines, under a VAT standing — the only way a bill's `total` is
 * worked out, at issue and when a refused discount puts it back to full price (`$lib/billTax.ts`).
 */
export async function totalsFromLines(
	reader: Reader,
	invoiceId: number,
	discount: number,
	vat: VatStanding
): Promise<BillTotals & { lines: number }> {
	const lines = await reader
		.select({ lineTotal: invoiceLine.lineTotal, taxable: invoiceLine.taxable })
		.from(invoiceLine)
		.where(and(eq(invoiceLine.invoiceId, invoiceId), notDeleted(invoiceLine)));
	return { ...billTotals(lines, discount, vat), lines: lines.length };
}

/** Writes lines onto a draft for these pieces of work, each checked to be unbilled and theirs. */
async function writeWorkLines(
	tx: Tx,
	event: AuditRequest,
	patientId: number,
	invoiceId: number,
	procedureIds: number[]
) {
	const wanted = [...new Set(procedureIds)];
	const offered = await unbilledWork(patientId, tx);
	const chosen = offered.filter((w) => wanted.includes(w.id));
	refuseUnless(
		chosen.length === wanted.length,
		billingRefusals(event).alreadyBilled,
		'procedureIds'
	);
	// Charted treatment carries VAT only where the clinic's accountant has said services do.
	const { vatOnServices } = await readSettings(tx);
	// Work a prepaid package covers is billed at nothing: it was paid for when the package was sold.
	const covered = await coverageFor(
		tx,
		patientId,
		chosen.map((w) => ({ procedureId: w.id, serviceId: w.serviceId }))
	);
	for (const [index, work] of chosen.entries()) {
		const cover = covered.get(work.id);
		const price = cover ? 0 : work.fee;
		const id = await insertReturningId(tx, invoiceLine, {
			taxable: vatOnServices,
			invoiceId,
			procedureId: work.id,
			description: cover
				? `${work.description} — in ${cover.name}`.slice(0, 255)
				: work.description,
			toothId: work.toothId,
			quantity: 1,
			unitPrice: price,
			lineTotal: price,
			patientPackageId: cover?.patientPackageId ?? null,
			sortOrder: index + 1,
			createdBy: event.locals.user?.id
		});
		await recordAudit(tx, event, { table: 'invoice_line', recordId: id, action: 'create' });
	}
	return chosen;
}

/**
 * Starts a draft bill from completed work — typically one visit's. The visit and dentist are
 * taken from the work when it all shares one, so "has this visit been billed" has an answer.
 *
 * `charges` are lines that are not charted work, for a bill raised by something other than the
 * billing tab — an orthodontic instalment falling due. A bill needs work or a charge.
 */
export async function createInvoice(
	tx: Tx,
	event: AuditRequest,
	input: {
		patientId: number;
		procedureIds: number[];
		branchId: number | null;
		charges?: { description: string; quantity: number; unitPrice: number }[];
		providerId?: number | null;
	}
): Promise<number> {
	const charges = input.charges ?? [];
	refuseUnless(
		input.procedureIds.length > 0 || charges.length > 0,
		billingRefusals(event).chooseWork,
		'procedureIds'
	);
	// Billed to whoever pays for this patient — their employer or insurer — unless changed on the draft.
	const [person] = await tx
		.select({ payer: patient.customerId })
		.from(patient)
		.where(eq(patient.id, input.patientId))
		.limit(1);
	const invoiceId = await insertReturningId(tx, invoice, {
		patientId: input.patientId,
		customerId: person?.payer ?? null,
		// Stamped from the branch being worked at, never defaulted (CLAUDE.md §15).
		branchId: input.branchId ?? undefined,
		status: 'draft',
		issuedOn: clinicToday(),
		subtotal: 0,
		total: 0,
		// A bill needs no second pair of eyes unless its discount or a void says so (see `invoice`).
		approvalStatus: 'approved',
		createdBy: event.locals.user?.id
	});
	await recordAudit(tx, event, { table: 'invoice', recordId: invoiceId, action: 'create' });

	for (const charge of charges) await addCharge(tx, event, input.patientId, invoiceId, charge);
	if (!input.procedureIds.length) {
		if (input.providerId) {
			await tx
				.update(invoice)
				.set({ providerId: input.providerId })
				.where(eq(invoice.id, invoiceId));
		}
		return invoiceId;
	}

	const work = await writeWorkLines(tx, event, input.patientId, invoiceId, input.procedureIds);
	const visits = [...new Set(work.map((w) => w.appointmentId))];
	const dentists = [...new Set(work.map((w) => w.providerId))];
	await tx
		.update(invoice)
		.set({
			appointmentId: visits.length === 1 ? visits[0] : null,
			providerId: dentists.length === 1 ? dentists[0] : null
		})
		.where(eq(invoice.id, invoiceId));
	return invoiceId;
}

/**
 * Who a draft is billed to: the patient themself (`null`), or an employer or insurer. Fixed once
 * issued, like everything else on the bill — the payer is what the paper says.
 */
export async function setPayer(
	tx: Tx,
	event: AuditRequest,
	patientId: number,
	invoiceId: number,
	customerId: number | null
) {
	const bill = await billFor(tx, patientId, invoiceId);
	refuseUnless(canEditInvoice(bill.status), billingRefusals(event).payerFixed);
	if (customerId !== null) {
		const [payer] = await tx
			.select({ id: customers.id })
			.from(customers)
			.where(and(eq(customers.id, customerId), notDeleted(customers)))
			.limit(1);
		refuseUnless(Boolean(payer), billingRefusals(event).choosePayer, 'customerId');
	}
	const written = { customerId, updatedBy: event.locals.user?.id };
	await tx.update(invoice).set(written).where(eq(invoice.id, invoiceId));
	await recordAudit(tx, event, {
		table: 'invoice',
		recordId: invoiceId,
		action: 'update',
		before: bill,
		after: written
	});
}

/** More completed work onto a draft. */
export async function addWorkToInvoice(
	tx: Tx,
	event: AuditRequest,
	patientId: number,
	invoiceId: number,
	procedureIds: number[]
) {
	const bill = await billFor(tx, patientId, invoiceId);
	refuseUnless(canEditInvoice(bill.status), billingRefusals(event).onlyDraft);
	await writeWorkLines(tx, event, patientId, invoiceId, procedureIds);
}

/** A charge that is not charted work — a missed-appointment fee, something sold — onto a draft. */
export async function addCharge(
	tx: Tx,
	event: AuditRequest,
	patientId: number,
	invoiceId: number,
	charge: { description: string; quantity: number; unitPrice: number; taxable?: boolean }
) {
	const bill = await billFor(tx, patientId, invoiceId);
	refuseUnless(canEditInvoice(bill.status), billingRefusals(event).onlyDraft);
	const id = await insertReturningId(tx, invoiceLine, {
		invoiceId,
		description: charge.description.trim().slice(0, 255),
		quantity: charge.quantity,
		unitPrice: charge.unitPrice,
		lineTotal: cents(charge.quantity * charge.unitPrice),
		taxable: charge.taxable ?? false,
		sortOrder: 1000,
		createdBy: event.locals.user?.id
	});
	await recordAudit(tx, event, { table: 'invoice_line', recordId: id, action: 'create' });
}

/** A draft line's wording, quantity or price. The total is worked out here. */
export async function updateInvoiceLine(
	tx: Tx,
	event: AuditRequest,
	patientId: number,
	invoiceId: number,
	change: { lineId: number; description: string; quantity: number; unitPrice: number }
) {
	const bill = await billFor(tx, patientId, invoiceId);
	refuseUnless(canEditInvoice(bill.status), billingRefusals(event).issuedNotEdited);
	const line = await lineOf(tx, invoiceId, change.lineId, billingRefusals(event).lineNotOnBill);
	const written = {
		description: change.description.trim().slice(0, 255),
		quantity: change.quantity,
		unitPrice: change.unitPrice,
		lineTotal: cents(change.quantity * change.unitPrice),
		updatedBy: event.locals.user?.id
	};
	await tx.update(invoiceLine).set(written).where(eq(invoiceLine.id, line.id));
	await recordAudit(tx, event, {
		table: 'invoice_line',
		recordId: line.id,
		action: 'update',
		before: line,
		after: written
	});
}

/** Takes a line off a draft. Its work becomes unbilled again. */
export async function removeInvoiceLine(
	tx: Tx,
	event: AuditRequest,
	patientId: number,
	invoiceId: number,
	lineId: number
) {
	const bill = await billFor(tx, patientId, invoiceId);
	refuseUnless(canEditInvoice(bill.status), billingRefusals(event).issuedNotEdited);
	const line = await lineOf(tx, invoiceId, lineId, billingRefusals(event).lineNotOnBill);
	await softDeleteInvoiceLine(tx, line.id, event.locals.user?.id);
	await recordAudit(tx, event, { table: 'invoice_line', recordId: line.id, action: 'delete' });
}

async function lineOf(tx: Tx, invoiceId: number, lineId: number, missing: string) {
	const [line] = await tx
		.select()
		.from(invoiceLine)
		.where(
			and(eq(invoiceLine.id, lineId), eq(invoiceLine.invoiceId, invoiceId), notDeleted(invoiceLine))
		)
		.limit(1);
	if (!line) throw new WriteRefused(null, missing);
	return line;
}

/** The discount on a draft, in birr. Whether it needs a manager is decided when it is issued. */
export async function setDiscount(
	tx: Tx,
	event: AuditRequest,
	patientId: number,
	invoiceId: number,
	discount: number
) {
	const bill = await billFor(tx, patientId, invoiceId);
	refuseUnless(canEditInvoice(bill.status), billingRefusals(event).onlyDraftDiscount);
	const [{ subtotal }] = await tx
		.select({ subtotal: sql<number>`COALESCE(SUM(${invoiceLine.lineTotal}), 0)` })
		.from(invoiceLine)
		.where(and(eq(invoiceLine.invoiceId, invoiceId), notDeleted(invoiceLine)));
	refuseUnless(
		discount >= 0 && discount <= Number(subtotal),
		billingRefusals(event).discountTooBig,
		'discount'
	);
	const written = {
		discount: discount > 0 ? cents(discount) : null,
		updatedBy: event.locals.user?.id
	};
	await tx.update(invoice).set(written).where(eq(invoice.id, invoiceId));
	await recordAudit(tx, event, {
		table: 'invoice',
		recordId: invoiceId,
		action: 'update',
		before: bill,
		after: written
	});
}

/**
 * Issues a draft: numbers it, dates it today, freezes its totals, and — when its discount is over
 * the clinic's threshold — sends it to a manager before it can be paid.
 */
export async function issueInvoice(
	tx: Tx,
	event: AuditRequest,
	patientId: number,
	invoiceId: number,
	options: { dueOn: string | null }
) {
	const bill = await billFor(tx, patientId, invoiceId);
	refuseUnless(bill.status === 'draft', billingRefusals(event).alreadyIssued);

	// A payer that requires a pre-authorisation must have given one, before anything is numbered.
	if (bill.customerId !== null) {
		await checkPreauth(tx, event, patientId, bill.customerId, clinicToday());
	}
	const settings = await readSettings(tx);
	const discount = bill.discount ?? 0;
	const totals = await totalsFromLines(tx, invoiceId, discount, {
		registered: settings.vatRegistered,
		rate: settings.vatRate
	});
	refuseUnless(totals.lines > 0, billingRefusals(event).needsLine);
	refuseUnless(discount <= totals.subtotal, billingRefusals(event).discountOverBill);
	const needsManager = discountNeedsApproval(
		totals.subtotal,
		discount,
		settings.discountApprovalPercent
	);

	const written = {
		status: 'issued' as const,
		invoiceNumber: await nextNumber(tx, 'invoice'),
		issuedOn: clinicToday(),
		dueOn: options.dueOn,
		subtotal: totals.subtotal,
		vatAmount: totals.vat,
		vatRate: totals.rate,
		total: totals.total,
		...(needsManager
			? asRequested(event.locals.user?.id)
			: { approvalStatus: 'approved' as const }),
		updatedBy: event.locals.user?.id
	};
	await tx.update(invoice).set(written).where(eq(invoice.id, invoiceId));
	await recordAudit(tx, event, {
		table: 'invoice',
		recordId: invoiceId,
		action: 'update',
		before: bill,
		after: written
	});
	// A payer's bill is divided now; one waiting for a manager, once the manager decides.
	if (!needsManager) await applyCover(tx, event, invoiceId);
	return { needsManager };
}

/** Throws away a draft. An issued bill is never deleted — it is voided, through a manager. */
export async function discardInvoice(
	tx: Tx,
	event: AuditRequest,
	patientId: number,
	invoiceId: number
) {
	const bill = await billFor(tx, patientId, invoiceId);
	refuseUnless(bill.status === 'draft', billingRefusals(event).voidNotDiscard);
	await softDeleteDraftInvoice(tx, invoiceId, event.locals.user?.id);
	await recordAudit(tx, event, { table: 'invoice', recordId: invoiceId, action: 'delete' });
}

/**
 * Asks for an issued bill to be voided. Nothing happens to it until a manager approves in the
 * Discounts and Voids queue (`APPROVAL_ENTITIES`), which calls `settleInvoiceRequests`.
 */
export async function requestVoid(
	tx: Tx,
	event: AuditRequest,
	patientId: number,
	invoiceId: number,
	reason: string
) {
	const bill = await billFor(tx, patientId, invoiceId);
	// Net of approved refunds: a bill refunded in full has nothing on it and can be voided.
	const paid = await paidOn(tx, invoiceId);
	refuseUnless(
		canRequestVoid(bill.status, bill.approvalStatus, paid),
		paid > 0 ? billingRefusals(event).refundFirst : billingRefusals(event).cannotVoid
	);
	const why = reason.trim();
	refuseUnless(why.length > 0, billingRefusals(event).sayWhyVoid, 'reason');
	const written = {
		voidReason: why.slice(0, 255),
		...asRequested(event.locals.user?.id),
		updatedBy: event.locals.user?.id
	};
	await tx.update(invoice).set(written).where(eq(invoice.id, invoiceId));
	await recordAudit(tx, event, {
		table: 'invoice',
		recordId: invoiceId,
		action: 'update',
		before: bill,
		after: written
	});
}

/**
 * What a manager's decision in the Discounts and Voids queue does to the bills it settled. The
 * queue sets `approvalStatus`; this does the rest, in the same transaction.
 *
 * A bill waiting is one of two requests, told apart by `voidReason`:
 *   - **a void** — approved, the bill is void from now; refused, it stands, the reason cleared
 *   - **a discount** — approved, it stands and can be paid; refused, the discount comes off and the
 *     bill stands at its full price
 *
 * Either way a refused request leaves the bill `approved` — payable, and in the patient's balance.
 * `rejectedBy` and `rejectionReason` stay on it as the record of what was refused.
 */
export async function settleInvoiceRequests(
	ids: number[],
	decision: 'approved' | 'rejected',
	database: Reader,
	userId?: string
) {
	if (!ids.length) return;
	const bills = await database
		.select({
			id: invoice.id,
			voidReason: invoice.voidReason,
			vatRate: invoice.vatRate,
			customerId: invoice.customerId
		})
		.from(invoice)
		.where(and(inArray(invoice.id, ids), ne(invoice.status, 'void')));

	for (const bill of bills) {
		if (bill.voidReason) {
			await database
				.update(invoice)
				.set(
					decision === 'approved'
						? { status: 'void', voidedAt: new Date() }
						: { voidReason: null, approvalStatus: 'approved' }
				)
				.where(eq(invoice.id, bill.id));
		} else if (decision === 'rejected') {
			// Full price again, VAT and all, at the rate the bill was issued at.
			const full = await totalsFromLines(database, bill.id, 0, {
				registered: bill.vatRate !== null,
				rate: bill.vatRate ?? 0
			});
			await database
				.update(invoice)
				.set({
					discount: null,
					vatAmount: full.vat,
					total: full.total,
					approvalStatus: 'approved'
				})
				.where(eq(invoice.id, bill.id));
		}
		// A payer's bill is divided once its total is final: its discount decided, and not voided.
		const stands = !bill.voidReason || decision === 'rejected';
		if (bill.customerId !== null && stands) {
			await applyCover(database, approvalActor(userId), bill.id);
		}
	}
}

/** Who to record a change made by the approvals queue against: the manager who decided. */
function approvalActor(userId: string | undefined): AuditRequest {
	return { locals: { user: userId ? { id: userId } : null }, getClientAddress: () => 'approvals' };
}
