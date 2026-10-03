/**
 * Ordering from suppliers: what an order's status follows from, how much to order of something
 * running low, and whether a supplier's invoice matches what was ordered and what arrived.
 * Client-safe and pure — the order page and `server/purchasing.ts` read the same rules.
 *
 * **The three-way match.** A supplier is paid for what the clinic ordered *and* received, at the
 * price agreed. So before an invoice is paid the page sets three figures side by side — ordered,
 * received, invoiced — and says plainly when the invoice is for more than arrived. It does not
 * block the payment: a supplier who delivered the rest yesterday, unrecorded, is common, and the
 * person paying can see it. It makes overpaying a decision rather than an accident.
 *
 * Non-goals: partial invoices against particular lines (a clinic's supplier invoices the order),
 * and price changes on delivery — the price is the order's; a different one is a note.
 */

export const ORDER_STATUSES = ['draft', 'sent', 'partly', 'received', 'cancelled'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
	draft: 'Draft',
	sent: 'Sent — awaiting delivery',
	partly: 'Partly received',
	received: 'Received',
	cancelled: 'Cancelled'
};

/** Whether deliveries can be received against an order. */
export const canReceive = (status: OrderStatus) => status === 'sent' || status === 'partly';

/** What an order's status is, from what its lines have received. Drafts and cancellations stand. */
export function statusFromLines(
	status: OrderStatus,
	lines: { quantity: number; received: number }[]
): OrderStatus {
	if (status === 'draft' || status === 'cancelled') return status;
	const received = lines.reduce((s, l) => s + l.received, 0);
	if (received <= 0) return 'sent';
	return lines.every((l) => l.received >= l.quantity) ? 'received' : 'partly';
}

/**
 * How much of an item to order when it is low: back up to twice its reorder level, so one order
 * lasts a while. At least one.
 */
export function suggestedQuantity(onHand: number, reorderLevel: number | null): number {
	const level = reorderLevel ?? 0;
	return Math.max(1, Math.ceil(level * 2 - Math.max(onHand, 0)));
}

const cents = (n: number) => Math.round(n * 100) / 100;

/** Ordered, received and invoiced, and whether they agree. */
export type Match = {
	ordered: number;
	received: number;
	invoiced: number;
	/** The invoices are for more than arrived, at the order's prices. */
	overInvoiced: boolean;
	/** Some of the order has not arrived. */
	short: boolean;
	/** A line has no price, so the money cannot be checked. */
	unpriced: boolean;
};

/** The three-way match of an order and its invoices. */
export function matchOrder(
	lines: { quantity: number; received: number; unitCost: number | null }[],
	invoices: { amount: number }[]
): Match {
	const ordered = cents(lines.reduce((s, l) => s + l.quantity * (l.unitCost ?? 0), 0));
	const received = cents(lines.reduce((s, l) => s + l.received * (l.unitCost ?? 0), 0));
	const invoiced = cents(invoices.reduce((s, i) => s + i.amount, 0));
	return {
		ordered,
		received,
		invoiced,
		overInvoiced: invoiced > received + 0.005,
		short: lines.some((l) => l.received < l.quantity),
		unpriced: lines.some((l) => l.unitCost === null)
	};
}
