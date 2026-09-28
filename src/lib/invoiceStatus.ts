/**
 * What can happen to an invoice next, as one table both halves read — the server refuses a step
 * that is not here and the bill's page offers only the steps that are. The same arrangement as
 * `appointmentStatus.ts` and `treatmentPlanStatus.ts`.
 *
 *     draft ── issued ─┬─ partly ── paid
 *                      └─ void          (through approval, and only while nothing is paid)
 *
 * **A draft is workspace; an issued bill is a document.** Lines, prices and the discount change
 * only on a draft. Issuing numbers the bill and freezes it (`invoice_line`), so what the patient
 * holds and what the system shows cannot come apart.
 *
 * **Money leaving quietly goes past a second person.** A discount above the clinic's threshold,
 * and any void, leave the bill waiting in the approvals queue (`approvalStatus = 'pending'`), and a
 * bill waiting there cannot take a payment — the amount owed is not settled until someone has
 * agreed to it.
 *
 * `partly` and `paid` are not chosen by anyone: they follow from what has been paid against the
 * total (`statusAfterPayment`).
 *
 * Client-safe: no server imports.
 */

export const INVOICE_STATUSES = ['draft', 'issued', 'partly', 'paid', 'void'] as const;

export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

/** How each status is said on screen. */
export const INVOICE_STATUS_LABEL: Record<InvoiceStatus, string> = {
	draft: 'Draft',
	issued: 'Unpaid',
	partly: 'Part paid',
	paid: 'Paid',
	void: 'Void'
};

/** Lines, prices and the discount may change. */
export function canEditInvoice(status: InvoiceStatus): boolean {
	return status === 'draft';
}

/**
 * A payment may be taken: the bill has been issued, is not settled or void, and is not waiting for
 * a manager to approve its discount or its void.
 */
export function canPay(status: InvoiceStatus, approval: 'pending' | 'approved' | 'rejected') {
	return (status === 'issued' || status === 'partly') && approval !== 'pending';
}

/**
 * A void may be asked for: the bill was issued and nothing has been paid against it. A bill with
 * money on it is refunded first, so the money's way out is on record before the bill disappears.
 */
export function canRequestVoid(
	status: InvoiceStatus,
	approval: 'pending' | 'approved' | 'rejected',
	paid: number
) {
	return status === 'issued' && approval !== 'pending' && paid <= 0;
}

/** The status a bill is in once `paid` of its `total` has been paid. */
export function statusAfterPayment(total: number, paid: number): 'issued' | 'partly' | 'paid' {
	if (paid <= 0) return 'issued';
	return paid + 0.005 >= total ? 'paid' : 'partly';
}

/**
 * Whether a discount needs a manager: above `thresholdPercent` of the bill before discount. A
 * threshold of 0 sends every discount; no discount never needs one.
 */
export function discountNeedsApproval(
	subtotal: number,
	discount: number,
	thresholdPercent: number
): boolean {
	if (discount <= 0) return false;
	if (subtotal <= 0) return true;
	return (discount / subtotal) * 100 > thresholdPercent + 1e-9;
}

/** Rounds to the cent, as a bill is printed. */
export function cents(amount: number): number {
	return Math.round(amount * 100) / 100;
}
