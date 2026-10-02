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
import { clinicToday } from '$lib/clinicTime';
import { canEditInvoice, canRequestVoid, cents, discountNeedsApproval } from '$lib/invoiceStatus';

/** A transaction on the database, as `db.transaction` hands it over. */
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** The database, or a transaction on it. */
type Reader = typeof db | Tx;

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
		'Some of that work is already billed, or no longer done. Reload and choose again.',
		'procedureIds'
	);
	for (const [index, work] of chosen.entries()) {
		const id = await insertReturningId(tx, invoiceLine, {
			invoiceId,
			procedureId: work.id,
			description: work.description,
			toothId: work.toothId,
			quantity: 1,
			unitPrice: work.fee,
			lineTotal: work.fee,
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
 */
export async function createInvoice(
	tx: Tx,
	event: AuditRequest,
	input: { patientId: number; procedureIds: number[]; branchId: number | null }
): Promise<number> {
	refuseUnless(input.procedureIds.length > 0, 'Choose the work to bill.', 'procedureIds');
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
	refuseUnless(canEditInvoice(bill.status), 'Who pays is fixed once the bill is issued.');
	if (customerId !== null) {
		const [payer] = await tx
			.select({ id: customers.id })
			.from(customers)
			.where(and(eq(customers.id, customerId), notDeleted(customers)))
			.limit(1);
		refuseUnless(Boolean(payer), 'Choose a payer from the list.', 'customerId');
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
	refuseUnless(canEditInvoice(bill.status), 'Only a draft bill can be changed.');
	await writeWorkLines(tx, event, patientId, invoiceId, procedureIds);
}

/** A charge that is not charted work — a missed-appointment fee, something sold — onto a draft. */
export async function addCharge(
	tx: Tx,
	event: AuditRequest,
	patientId: number,
	invoiceId: number,
	charge: { description: string; quantity: number; unitPrice: number }
) {
	const bill = await billFor(tx, patientId, invoiceId);
	refuseUnless(canEditInvoice(bill.status), 'Only a draft bill can be changed.');
	const id = await insertReturningId(tx, invoiceLine, {
		invoiceId,
		description: charge.description.trim().slice(0, 255),
		quantity: charge.quantity,
		unitPrice: charge.unitPrice,
		lineTotal: cents(charge.quantity * charge.unitPrice),
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
	refuseUnless(
		canEditInvoice(bill.status),
		'An issued bill is what the patient holds; it is not edited.'
	);
	const line = await lineOf(tx, invoiceId, change.lineId);
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
	refuseUnless(
		canEditInvoice(bill.status),
		'An issued bill is what the patient holds; it is not edited.'
	);
	const line = await lineOf(tx, invoiceId, lineId);
	await softDeleteInvoiceLine(tx, line.id, event.locals.user?.id);
	await recordAudit(tx, event, { table: 'invoice_line', recordId: line.id, action: 'delete' });
}

async function lineOf(tx: Tx, invoiceId: number, lineId: number) {
	const [line] = await tx
		.select()
		.from(invoiceLine)
		.where(
			and(eq(invoiceLine.id, lineId), eq(invoiceLine.invoiceId, invoiceId), notDeleted(invoiceLine))
		)
		.limit(1);
	if (!line) throw new WriteRefused(null, 'That line is not on this bill.');
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
	refuseUnless(canEditInvoice(bill.status), 'Only a draft bill can be discounted.');
	const [{ subtotal }] = await tx
		.select({ subtotal: sql<number>`COALESCE(SUM(${invoiceLine.lineTotal}), 0)` })
		.from(invoiceLine)
		.where(and(eq(invoiceLine.invoiceId, invoiceId), notDeleted(invoiceLine)));
	refuseUnless(
		discount >= 0 && discount <= Number(subtotal),
		'A discount cannot be more than the bill.',
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
	refuseUnless(bill.status === 'draft', 'This bill has already been issued.');

	const [{ subtotal, lines }] = await tx
		.select({
			subtotal: sql<number>`COALESCE(SUM(${invoiceLine.lineTotal}), 0)`,
			lines: sql<number>`COUNT(*)`
		})
		.from(invoiceLine)
		.where(and(eq(invoiceLine.invoiceId, invoiceId), notDeleted(invoiceLine)));
	refuseUnless(Number(lines) > 0, 'A bill needs at least one line.');

	const gross = cents(Number(subtotal));
	const discount = bill.discount ?? 0;
	refuseUnless(discount <= gross, 'The discount is more than the bill. Change it first.');
	const settings = await readSettings(tx);
	const needsManager = discountNeedsApproval(gross, discount, settings.discountApprovalPercent);

	const written = {
		status: 'issued' as const,
		invoiceNumber: await nextNumber(tx, 'invoice'),
		issuedOn: clinicToday(),
		dueOn: options.dueOn,
		subtotal: gross,
		total: cents(gross - discount),
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
	refuseUnless(bill.status === 'draft', 'An issued bill is voided, not discarded.');
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
		paid > 0
			? 'Money has been paid against this bill. Refund it first; a bill is voided with nothing on it.'
			: 'This bill cannot be voided now.'
	);
	const why = reason.trim();
	refuseUnless(why.length > 0, 'Say why it is being voided.', 'reason');
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
	database: Reader
) {
	if (!ids.length) return;
	const bills = await database
		.select({
			id: invoice.id,
			voidReason: invoice.voidReason,
			subtotal: invoice.subtotal
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
			await database
				.update(invoice)
				.set({ discount: null, total: bill.subtotal, approvalStatus: 'approved' })
				.where(eq(invoice.id, bill.id));
		}
	}
}
