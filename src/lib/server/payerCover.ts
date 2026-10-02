/**
 * What a payer covers, applied to a bill billed to them: the co-payment, the member's yearly limit,
 * and the payer's pre-authorisation (`$lib/payerCover.ts` is the rule).
 *
 * **One debtor per bill, still.** The part the patient owes is not a second column on the payer's
 * bill — every balance, payment and receivable in the app reads one debtor per bill, and splitting
 * that would touch all of them. It is carved off at issue onto a **co-payment bill** of its own,
 * issued to the patient at the same moment, numbered and linked back (`coPayOfInvoiceId`). The
 * payer's bill keeps its lines and says what was carved (`coPayment`); its `total` is the payer's
 * part.
 *
 * **When.** At issue — or, for a bill whose discount waits for a manager, once the manager decides,
 * since its total is not final until then (`settleInvoiceRequests`). `coPayment` set (to 0 when
 * nothing was carved) marks a bill as divided, so it is never divided twice.
 *
 * **The year is Ethiopian**, Meskerem to Pagume, as the document numbers count it; a member's
 * limit is against what the payer was billed for them in it.
 *
 * Non-goals: claims adjudication (the payer decides on the claim what it will actually pay;
 * short-paid payer bills stay owing, and a manager writes them off), and moving a co-payment back
 * if the payer bill is later voided — the void goes through a manager, who voids the co-payment
 * bill as well.
 */
import { and, desc, eq, gte, inArray, isNull, lte, ne, or, sql } from 'drizzle-orm';

import { db } from '$lib/server/db';
import {
	customers,
	invoice,
	invoiceLine,
	patient,
	payerAuthorisation
} from '$lib/server/db/schema';
import { notDeleted } from '$lib/server/softDelete';
import { refuseUnless } from '$lib/server/childCrud';
import { recordAudit, type AuditRequest } from '$lib/server/audit';
import { insertReturningId } from '@nahu/admin-kit/server/db/insert.js';
import { nextNumber } from '$lib/server/documentNumbers';
import { payerInvoices } from '$lib/server/billing';
import { coverSplit } from '$lib/payerCover';
import { ethiopianToIso, ethiopianYearEnd } from '$lib/ethiopianCalendar';
import { getEthiopianYearMonth } from '$lib/global.svelte';
import { messagesFor } from '$lib/i18n/messages';
import { isLang } from '$lib/i18n/lang';

/** The database or a transaction on it; the approvals queue hands its transaction as either. */
type Reader = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Statuses a bill has once issued and not voided: what a payer has been billed. */
const BILLED = ['issued', 'partly', 'paid'] as const;

/** The Ethiopian year a clinic day falls in, as its first and last Gregorian day. */
function ethiopianYearOf(day: string): { start: string; end: string } {
	const year = getEthiopianYearMonth(new Date(`${day}T12:00:00Z`))?.year ?? 0;
	return { start: ethiopianToIso(year, 1, 1), end: ethiopianYearEnd(year) };
}

/** A payer's terms, or null when the payer no longer exists. */
export async function payerTerms(reader: Reader, customerId: number) {
	const [row] = await reader
		.select({
			name: customers.name,
			coveragePercent: customers.coveragePercent,
			annualLimit: customers.annualLimit,
			requiresPreauth: customers.requiresPreauth
		})
		.from(customers)
		.where(eq(customers.id, customerId))
		.limit(1);
	return row ?? null;
}

/** What a payer has been billed for one member in the Ethiopian year of `day`. */
export async function usedThisYear(
	reader: Reader,
	patientId: number,
	customerId: number,
	day: string,
	excludeInvoiceId: number | null = null
): Promise<number> {
	const { start, end } = ethiopianYearOf(day);
	const [row] = await reader
		.select({ used: sql<number>`COALESCE(SUM(${invoice.total}), 0)` })
		.from(invoice)
		.where(
			and(
				eq(invoice.patientId, patientId),
				eq(invoice.customerId, customerId),
				inArray(invoice.status, [...BILLED]),
				gte(invoice.issuedOn, start),
				lte(invoice.issuedOn, end),
				notDeleted(invoice),
				excludeInvoiceId === null ? undefined : ne(invoice.id, excludeInvoiceId)
			)
		);
	return Math.round(Number(row?.used ?? 0) * 100) / 100;
}

/**
 * The patient's approved authorisation from this payer, in date on `day`, with what is left of it —
 * the newest with anything left — or null.
 */
export async function liveAuthorisation(
	reader: Reader,
	patientId: number,
	customerId: number,
	day: string,
	excludeInvoiceId: number | null = null
): Promise<{ id: number; reference: string | null; left: number } | null> {
	const used = reader
		.select({
			authorisationId: invoice.authorisationId,
			used: sql<number>`SUM(${invoice.total})`.as('used')
		})
		.from(invoice)
		.where(
			and(
				inArray(invoice.status, [...BILLED]),
				notDeleted(invoice),
				excludeInvoiceId === null ? undefined : ne(invoice.id, excludeInvoiceId)
			)
		)
		.groupBy(invoice.authorisationId)
		.as('auth_used');
	const rows = await reader
		.select({
			id: payerAuthorisation.id,
			reference: payerAuthorisation.reference,
			approved: payerAuthorisation.approvedAmount,
			used: used.used
		})
		.from(payerAuthorisation)
		.leftJoin(used, eq(used.authorisationId, payerAuthorisation.id))
		.where(
			and(
				eq(payerAuthorisation.patientId, patientId),
				eq(payerAuthorisation.customerId, customerId),
				eq(payerAuthorisation.status, 'approved'),
				eq(payerAuthorisation.isActive, true),
				or(isNull(payerAuthorisation.validUntil), gte(payerAuthorisation.validUntil, day)),
				notDeleted(payerAuthorisation)
			)
		)
		.orderBy(desc(payerAuthorisation.id));
	for (const row of rows) {
		const left = Math.round(((row.approved ?? 0) - Number(row.used ?? 0)) * 100) / 100;
		if (left > 0) return { id: row.id, reference: row.reference, left };
	}
	return null;
}

/**
 * Refuses to issue a bill to a payer that requires a pre-authorisation when the patient has none
 * approved and in date. Run before issuing, so nothing is numbered for a bill that cannot stand.
 */
export async function checkPreauth(
	tx: Reader,
	event: AuditRequest,
	patientId: number,
	customerId: number,
	day: string
): Promise<void> {
	const terms = await payerTerms(tx, customerId);
	if (!terms?.requiresPreauth) return;
	const auth = await liveAuthorisation(tx, patientId, customerId, day);
	refuseUnless(auth !== null, wordsFor(event).needsPreauth(terms.name));
}

/** The cover words in the request's language, or English for an approval with no request. */
function wordsFor(event: AuditRequest) {
	const lang = 'lang' in event.locals && isLang(event.locals.lang) ? event.locals.lang : 'en';
	return messagesFor(lang).billing.cover;
}

/**
 * Divides an issued, approved bill billed to a payer: the payer's part stays, the patient's goes
 * onto a co-payment bill issued to them now. Returns the co-payment bill's id, or null when nothing
 * was carved — or the bill is not one to divide, or already was.
 */
export async function applyCover(
	tx: Reader,
	event: AuditRequest,
	invoiceId: number
): Promise<number | null> {
	const [bill] = await tx
		.select()
		.from(invoice)
		.where(and(eq(invoice.id, invoiceId), notDeleted(invoice)))
		.limit(1)
		.for('update');
	if (
		!bill ||
		bill.customerId === null ||
		bill.coPayment !== null ||
		bill.approvalStatus !== 'approved' ||
		!(BILLED as readonly string[]).includes(bill.status)
	) {
		return null;
	}
	const terms = await payerTerms(tx, bill.customerId);
	if (!terms) return null;

	const used = await usedThisYear(tx, bill.patientId, bill.customerId, bill.issuedOn, bill.id);
	const auth = terms.requiresPreauth
		? await liveAuthorisation(tx, bill.patientId, bill.customerId, bill.issuedOn, bill.id)
		: null;
	const split = coverSplit({
		total: bill.total,
		coveragePercent: terms.coveragePercent,
		limitLeft: terms.annualLimit === null ? null : terms.annualLimit - used,
		authorisedLeft: terms.requiresPreauth ? (auth?.left ?? 0) : null
	});

	const written = {
		total: split.payer,
		coPayment: split.patient,
		authorisationId: auth?.id ?? null,
		updatedBy: event.locals.user?.id
	};
	await tx.update(invoice).set(written).where(eq(invoice.id, bill.id));
	await recordAudit(tx, event, {
		table: 'invoice',
		recordId: bill.id,
		action: 'update',
		before: bill,
		after: written,
		detail: { cover: { payer: split.payer, patient: split.patient, cappedBy: split.cappedBy } }
	});
	if (split.patient <= 0) return null;

	const words = wordsFor(event);
	const coPayId = await insertReturningId(tx, invoice, {
		patientId: bill.patientId,
		customerId: null,
		branchId: bill.branchId,
		providerId: bill.providerId,
		appointmentId: bill.appointmentId,
		invoiceNumber: await nextNumber(tx, 'invoice'),
		issuedOn: bill.issuedOn,
		status: 'issued',
		subtotal: split.patient,
		total: split.patient,
		coPayOfInvoiceId: bill.id,
		approvalStatus: 'approved',
		createdBy: event.locals.user?.id
	});
	const description =
		split.cappedBy === 'limit'
			? words.overLimitLine(bill.invoiceNumber ?? '', terms.name)
			: split.cappedBy === 'authorisation'
				? words.overAuthorisationLine(bill.invoiceNumber ?? '', terms.name)
				: words.coPayLine(bill.invoiceNumber ?? '', terms.name, 100 - terms.coveragePercent);
	const lineId = await insertReturningId(tx, invoiceLine, {
		invoiceId: coPayId,
		description: description.slice(0, 255),
		quantity: 1,
		unitPrice: split.patient,
		lineTotal: split.patient,
		createdBy: event.locals.user?.id
	});
	await recordAudit(tx, event, { table: 'invoice', recordId: coPayId, action: 'create' });
	await recordAudit(tx, event, { table: 'invoice_line', recordId: lineId, action: 'create' });
	return coPayId;
}

/**
 * A payer's claim for one period: every bill billed to them that was issued in it and not voided,
 * with the member number and pre-authorisation each was billed under — what an insurer's claims
 * office asks for at the end of the month. Oldest first, as a claim is read.
 */
export async function payerClaim(customerId: number, period: { start: string; end: string }) {
	const bills = (await payerInvoices(customerId)).filter(
		(b) => b.status !== 'void' && b.issuedOn >= period.start && b.issuedOn <= period.end
	);
	if (bills.length === 0) return [];
	const extra = await db
		.select({
			id: invoice.id,
			memberNo: patient.payerMemberNo,
			authorisation: payerAuthorisation.reference
		})
		.from(invoice)
		.innerJoin(patient, eq(patient.id, invoice.patientId))
		.leftJoin(payerAuthorisation, eq(payerAuthorisation.id, invoice.authorisationId))
		.where(
			inArray(
				invoice.id,
				bills.map((b) => b.id)
			)
		);
	const byId = new Map(extra.map((e) => [e.id, e]));
	return bills
		.map((b) => ({
			...b,
			memberNo: byId.get(b.id)?.memberNo ?? null,
			authorisation: byId.get(b.id)?.authorisation ?? null
		}))
		.sort((a, b) => a.issuedOn.localeCompare(b.issuedOn) || a.id - b.id);
}

/**
 * What links a bill to the cover: on a payer's bill, the patient's co-payment bill carved from it
 * and the authorisation it used; on a co-payment bill, the payer's bill it came from.
 */
export async function coverLinks(bill: {
	id: number;
	coPayOfInvoiceId: number | null;
	authorisationId: number | null;
}) {
	const [coPay, source, auth] = await Promise.all([
		db
			.select({ id: invoice.id, number: invoice.invoiceNumber })
			.from(invoice)
			.where(and(eq(invoice.coPayOfInvoiceId, bill.id), notDeleted(invoice)))
			.limit(1),
		bill.coPayOfInvoiceId === null
			? Promise.resolve([])
			: db
					.select({ id: invoice.id, number: invoice.invoiceNumber })
					.from(invoice)
					.where(eq(invoice.id, bill.coPayOfInvoiceId))
					.limit(1),
		bill.authorisationId === null
			? Promise.resolve([])
			: db
					.select({ reference: payerAuthorisation.reference })
					.from(payerAuthorisation)
					.where(eq(payerAuthorisation.id, bill.authorisationId))
					.limit(1)
	]);
	return {
		coPayBill: coPay[0] ?? null,
		payerBill: source[0] ?? null,
		authorisation: auth[0]?.reference ?? null
	};
}
