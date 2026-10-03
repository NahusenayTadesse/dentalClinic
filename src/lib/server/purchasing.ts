/**
 * Purchasing: drafting an order to a supplier, sending it, receiving deliveries against it into
 * the stock lots, and recording and paying the supplier's invoice. The rules are
 * `$lib/purchasing.ts`'s; every write re-checks them, because the form is a courtesy (§9).
 *
 *   - a draft's lines change freely; sending numbers the order and fixes them
 *   - a delivery is received against one line, never more than is still outstanding on it, into a
 *     new lot through `moveStock` — with the order's supplier and price, the batch and expiry from
 *     the box, and a ledger row pointing back at the line. A controlled medicine needs its batch
 *     (`$lib/controlledDrugs.ts`), an item that expires its expiry date, exactly as on the item's
 *     own page
 *   - a supplier's invoice is recorded against the order, and paid — now or later — as money out
 *     through `transactions`, which the accounting export posts to stock
 *
 * Audit (§11): an order's sending, cancelling and each receipt; each invoice and its payment.
 *
 * Non-goals: approvals for large orders (a clinic's orders are its owner's), supplier price lists,
 * and returns to the supplier — a damaged delivery is written off on the item's page as now.
 */
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';

import { db } from '$lib/server/db';
import {
	medicine,
	paymentMethods,
	purchaseOrder,
	purchaseOrderLine,
	supplierInvoice,
	supplies,
	suppliesAdjustments,
	supplySuppliers,
	transactions
} from '$lib/server/db/schema';
import { insertReturningId } from '@nahu/admin-kit/server/db/insert.js';
import { notDeleted, softDeletePurchaseLines } from '$lib/server/softDelete';
import { recordAudit, type AuditRequest } from '$lib/server/audit';
import { WriteRefused, refuseUnless } from '$lib/server/childCrud';
import { branchFilter, type BranchContext } from '$lib/server/branchScope';
import { moveStock, onHand } from '$lib/server/stock';
import { nextNumber } from '$lib/server/documentNumbers';
import { clinicToday } from '$lib/clinicTime';
import { controlledRefusal } from '$lib/controlledDrugs';
import {
	canReceive,
	matchOrder,
	statusFromLines,
	suggestedQuantity,
	type OrderStatus
} from '$lib/purchasing';

/** A transaction on the database, as `db.transaction` hands it over. */
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Scope = Pick<BranchContext, 'active'>;
type Event = AuditRequest & { locals: { branch: Scope } };

/** Who orders and receives: whoever keeps the store. */
export const PURCHASING_PERMISSION = 'supplies_suppliers.manage';

/** The orders at the branch, newest first, each with its value and how much has arrived. */
export async function orderList(scope: Scope) {
	const orders = await db
		.select({
			id: purchaseOrder.id,
			number: purchaseOrder.number,
			status: purchaseOrder.status,
			supplier: supplySuppliers.name,
			orderedOn: purchaseOrder.orderedOn,
			expectedOn: purchaseOrder.expectedOn,
			createdAt: purchaseOrder.createdAt
		})
		.from(purchaseOrder)
		.innerJoin(supplySuppliers, eq(supplySuppliers.id, purchaseOrder.supplierId))
		.where(and(notDeleted(purchaseOrder), branchFilter(purchaseOrder.branchId, scope)))
		.orderBy(desc(purchaseOrder.createdAt), desc(purchaseOrder.id));
	if (!orders.length) return [];
	const ids = orders.map((o) => o.id);
	const [lines, invoices] = await Promise.all([
		db
			.select({
				orderId: purchaseOrderLine.orderId,
				quantity: purchaseOrderLine.quantity,
				received: purchaseOrderLine.received,
				unitCost: purchaseOrderLine.unitCost
			})
			.from(purchaseOrderLine)
			.where(and(inArray(purchaseOrderLine.orderId, ids), notDeleted(purchaseOrderLine))),
		db
			.select({ orderId: supplierInvoice.orderId, amount: supplierInvoice.amount })
			.from(supplierInvoice)
			.where(and(inArray(supplierInvoice.orderId, ids), notDeleted(supplierInvoice)))
	]);
	return orders.map((o) => ({
		...o,
		lines: lines.filter((l) => l.orderId === o.id).length,
		...matchOrder(
			lines.filter((l) => l.orderId === o.id),
			invoices.filter((i) => i.orderId === o.id)
		)
	}));
}

/** One row of `orderList`. */
export type OrderRow = Awaited<ReturnType<typeof orderList>>[number];

/** One order with its lines and invoices, or null when it is not at this branch. */
export async function orderDetail(scope: Scope, orderId: number) {
	const [order] = await db
		.select({
			id: purchaseOrder.id,
			number: purchaseOrder.number,
			status: purchaseOrder.status,
			supplierId: purchaseOrder.supplierId,
			supplier: supplySuppliers.name,
			supplierPhone: supplySuppliers.phone,
			supplierEmail: supplySuppliers.email,
			branchId: purchaseOrder.branchId,
			orderedOn: purchaseOrder.orderedOn,
			expectedOn: purchaseOrder.expectedOn,
			note: purchaseOrder.note
		})
		.from(purchaseOrder)
		.innerJoin(supplySuppliers, eq(supplySuppliers.id, purchaseOrder.supplierId))
		.where(
			and(
				eq(purchaseOrder.id, orderId),
				notDeleted(purchaseOrder),
				branchFilter(purchaseOrder.branchId, scope)
			)
		)
		.limit(1);
	if (!order) return null;

	const [lines, invoices] = await Promise.all([
		db
			.select({
				id: purchaseOrderLine.id,
				supplyId: purchaseOrderLine.supplyId,
				item: supplies.name,
				unit: supplies.unitOfMeasure,
				tracksExpiry: supplies.tracksExpiry,
				controlled: sql<boolean>`${medicine.controlClass} is not null`.mapWith(Boolean),
				onHand: onHand(),
				quantity: purchaseOrderLine.quantity,
				unitCost: purchaseOrderLine.unitCost,
				received: purchaseOrderLine.received
			})
			.from(purchaseOrderLine)
			.innerJoin(supplies, eq(supplies.id, purchaseOrderLine.supplyId))
			.leftJoin(medicine, eq(medicine.id, supplies.medicineId))
			.where(and(eq(purchaseOrderLine.orderId, orderId), notDeleted(purchaseOrderLine)))
			.orderBy(asc(supplies.name)),
		db
			.select({
				id: supplierInvoice.id,
				invoiceNo: supplierInvoice.invoiceNo,
				invoiceDate: supplierInvoice.invoiceDate,
				amount: supplierInvoice.amount,
				note: supplierInvoice.note,
				transactionId: supplierInvoice.transactionId,
				paidWith: paymentMethods.name
			})
			.from(supplierInvoice)
			.leftJoin(transactions, eq(transactions.id, supplierInvoice.transactionId))
			.leftJoin(paymentMethods, eq(paymentMethods.id, transactions.paymentMethodId))
			.where(and(eq(supplierInvoice.orderId, orderId), notDeleted(supplierInvoice)))
			.orderBy(asc(supplierInvoice.invoiceDate))
	]);
	return { order, lines, invoices, match: matchOrder(lines, invoices) };
}

/** The items at the branch, for adding a line, with what is on hand and what to order. */
export async function orderableItems(scope: Scope) {
	const rows = await db
		.select({
			id: supplies.id,
			name: supplies.name,
			unit: supplies.unitOfMeasure,
			reorderLevel: supplies.reorderLevel,
			onHand: onHand()
		})
		.from(supplies)
		.where(and(notDeleted(supplies), branchFilter(supplies.branchId, scope)))
		.orderBy(asc(supplies.name));
	return rows.map((r) => ({
		...r,
		onHand: Number(r.onHand),
		low: r.reorderLevel !== null && Number(r.onHand) <= r.reorderLevel,
		suggested: suggestedQuantity(Number(r.onHand), r.reorderLevel)
	}));
}

/** The order, locked, if it is at this branch. */
async function orderFor(tx: Tx, scope: Scope, orderId: number) {
	const [row] = await tx
		.select({
			id: purchaseOrder.id,
			status: purchaseOrder.status,
			supplierId: purchaseOrder.supplierId,
			number: purchaseOrder.number,
			branchId: purchaseOrder.branchId
		})
		.from(purchaseOrder)
		.where(
			and(
				eq(purchaseOrder.id, orderId),
				notDeleted(purchaseOrder),
				branchFilter(purchaseOrder.branchId, scope)
			)
		)
		.limit(1)
		.for('update');
	refuseUnless(Boolean(row), 'That order is not in this branch’s list.');
	return row;
}

/** Starts a draft order to a supplier. Returns its id. */
export async function draftOrder(tx: Tx, event: Event, supplierId: number): Promise<number> {
	const [supplier] = await tx
		.select({ id: supplySuppliers.id })
		.from(supplySuppliers)
		.where(and(eq(supplySuppliers.id, supplierId), notDeleted(supplySuppliers)))
		.limit(1);
	refuseUnless(Boolean(supplier), 'Choose a supplier from the list.', 'supplierId');
	return insertReturningId(tx, purchaseOrder, {
		supplierId,
		// Stamped from the branch being worked at, never defaulted (CLAUDE.md §15).
		branchId: event.locals.branch.active ?? undefined,
		createdBy: event.locals.user?.id
	});
}

/**
 * Replaces a draft's lines, its expected date and its note. Only while it is a draft; every item
 * must be one of the branch's, once each.
 */
export async function saveDraft(
	tx: Tx,
	event: Event,
	orderId: number,
	input: {
		lines: { supplyId: number; quantity: number; unitCost: number | null }[];
		expectedOn: string | null;
		note: string | null;
	}
) {
	const order = await orderFor(tx, event.locals.branch, orderId);
	refuseUnless(order.status === 'draft', 'A sent order is not changed. Cancel it and order again.');
	const ids = input.lines.map((l) => l.supplyId);
	refuseUnless(new Set(ids).size === ids.length, 'An item is on the order twice.');
	refuseUnless(
		input.lines.every((l) => l.quantity > 0 && (l.unitCost === null || l.unitCost >= 0)),
		'Each line needs a quantity, and a price that is not negative.'
	);
	if (ids.length) {
		const known = await tx
			.select({ id: supplies.id })
			.from(supplies)
			.where(
				and(
					inArray(supplies.id, ids),
					notDeleted(supplies),
					branchFilter(supplies.branchId, event.locals.branch)
				)
			);
		refuseUnless(known.length === ids.length, 'An item is not one of this branch’s.');
	}
	const old = await tx
		.select({ id: purchaseOrderLine.id })
		.from(purchaseOrderLine)
		.where(and(eq(purchaseOrderLine.orderId, orderId), notDeleted(purchaseOrderLine)));
	await softDeletePurchaseLines(
		tx,
		old.map((o) => o.id),
		event.locals.user?.id
	);
	if (input.lines.length) {
		await tx.insert(purchaseOrderLine).values(
			input.lines.map((l) => ({
				orderId,
				supplyId: l.supplyId,
				quantity: l.quantity,
				unitCost: l.unitCost,
				createdBy: event.locals.user?.id
			}))
		);
	}
	await tx
		.update(purchaseOrder)
		.set({ expectedOn: input.expectedOn, note: input.note, updatedBy: event.locals.user?.id })
		.where(eq(purchaseOrder.id, orderId));
}

/** Sends a draft: numbers it and dates it. It needs at least one line. */
export async function sendOrder(tx: Tx, event: Event, orderId: number): Promise<string> {
	const order = await orderFor(tx, event.locals.branch, orderId);
	refuseUnless(order.status === 'draft', 'This order has already been sent.');
	const [lines] = await tx
		.select({ n: sql<number>`count(*)`.mapWith(Number) })
		.from(purchaseOrderLine)
		.where(and(eq(purchaseOrderLine.orderId, orderId), notDeleted(purchaseOrderLine)));
	refuseUnless((lines?.n ?? 0) > 0, 'Add what is being ordered first.');
	const after = {
		status: 'sent' as const,
		number: await nextNumber(tx, 'purchaseOrder'),
		orderedOn: clinicToday(),
		updatedBy: event.locals.user?.id
	};
	await tx.update(purchaseOrder).set(after).where(eq(purchaseOrder.id, orderId));
	await recordAudit(tx, event, {
		table: 'purchase_order',
		recordId: orderId,
		action: 'update',
		before: { status: order.status, number: null },
		after: { status: after.status, number: after.number }
	});
	return after.number;
}

/** Cancels an order nothing has been received against. */
export async function cancelOrder(tx: Tx, event: Event, orderId: number) {
	const order = await orderFor(tx, event.locals.branch, orderId);
	refuseUnless(
		order.status === 'draft' || order.status === 'sent',
		'Something has been received against this order; it cannot be cancelled.'
	);
	await tx
		.update(purchaseOrder)
		.set({ status: 'cancelled', updatedBy: event.locals.user?.id })
		.where(eq(purchaseOrder.id, orderId));
	await recordAudit(tx, event, {
		table: 'purchase_order',
		recordId: orderId,
		action: 'update',
		before: { status: order.status },
		after: { status: 'cancelled' }
	});
}

/**
 * Receives a delivery against one line of an order: a new lot through `moveStock`, a ledger row
 * pointing back at the line, the line's received count, and the order's status.
 */
export async function receivePurchase(
	tx: Tx,
	event: Event,
	orderId: number,
	input: {
		lineId: number;
		quantity: number;
		batchNumber: string | null;
		expiryDate: string | null;
	}
) {
	const order = await orderFor(tx, event.locals.branch, orderId);
	refuseUnless(canReceive(order.status), 'Deliveries are received against a sent order.');
	const [line] = await tx
		.select({
			id: purchaseOrderLine.id,
			supplyId: purchaseOrderLine.supplyId,
			quantity: purchaseOrderLine.quantity,
			received: purchaseOrderLine.received,
			unitCost: purchaseOrderLine.unitCost,
			tracksExpiry: supplies.tracksExpiry,
			controlClass: medicine.controlClass
		})
		.from(purchaseOrderLine)
		.innerJoin(supplies, eq(supplies.id, purchaseOrderLine.supplyId))
		.leftJoin(medicine, eq(medicine.id, supplies.medicineId))
		.where(
			and(
				eq(purchaseOrderLine.id, input.lineId),
				eq(purchaseOrderLine.orderId, orderId),
				notDeleted(purchaseOrderLine)
			)
		)
		.limit(1)
		.for('update');
	if (!line) throw new WriteRefused('lineId', 'That line is not on this order.');
	const outstanding = Math.round((line.quantity - line.received) * 100) / 100;
	refuseUnless(input.quantity > 0, 'Say how many arrived.', 'quantity');
	refuseUnless(
		input.quantity <= outstanding,
		`Only ${outstanding} are still to come on this line. Receive any extra on the item's own page.`,
		'quantity'
	);
	if (line.tracksExpiry) {
		refuseUnless(
			Boolean(input.expiryDate),
			'This item expires — enter the date on the box.',
			'expiryDate'
		);
	}
	refuseUnless(
		!input.expiryDate || input.expiryDate > clinicToday(),
		'That is today or already past — expired stock is not received.',
		'expiryDate'
	);
	if (line.controlClass) {
		const refusal = controlledRefusal({
			intent: 'add',
			batchNumber: input.batchNumber,
			supplierId: order.supplierId,
			patientId: null,
			reason: null
		});
		if (refusal) throw new WriteRefused(refusal.field, refusal.text);
	}

	const [lot] = await moveStock(tx, {
		supplyId: line.supplyId,
		delta: input.quantity,
		userId: event.locals.user?.id,
		batchNumber: input.batchNumber,
		expiryDate: input.expiryDate,
		unitCost: line.unitCost,
		supplierId: order.supplierId
	});
	await tx.insert(suppliesAdjustments).values({
		suppliesId: line.supplyId,
		movementType: 'received',
		adjustment: input.quantity,
		batchId: lot?.batchId ?? null,
		supplierId: order.supplierId,
		costPerItem: line.unitCost === null ? null : String(line.unitCost),
		reason: `Received against ${order.number ?? 'an order'}`,
		purchaseOrderLineId: line.id,
		createdBy: event.locals.user?.id
	});
	const received = Math.round((line.received + input.quantity) * 100) / 100;
	await tx
		.update(purchaseOrderLine)
		.set({ received, updatedBy: event.locals.user?.id })
		.where(eq(purchaseOrderLine.id, line.id));

	const lines = await tx
		.select({ quantity: purchaseOrderLine.quantity, received: purchaseOrderLine.received })
		.from(purchaseOrderLine)
		.where(and(eq(purchaseOrderLine.orderId, orderId), notDeleted(purchaseOrderLine)));
	const status: OrderStatus = statusFromLines(order.status, lines);
	if (status !== order.status) {
		await tx
			.update(purchaseOrder)
			.set({ status, updatedBy: event.locals.user?.id })
			.where(eq(purchaseOrder.id, orderId));
	}
	await recordAudit(tx, event, {
		table: 'purchase_order',
		recordId: orderId,
		action: 'update',
		before: { status: order.status },
		after: { status },
		detail: { received: { line: line.id, quantity: input.quantity } }
	});
}

/** Pays money out for a supplier's invoice: a `transactions` row, linked to the invoice. */
async function payOut(
	tx: Tx,
	event: Event,
	invoiceId: number,
	input: {
		amount: number;
		paymentMethodId: number;
		invoiceNo: string;
		orderNumber: string | null;
		branchId: number | null;
	}
) {
	const [method] = await tx
		.select({ id: paymentMethods.id })
		.from(paymentMethods)
		.where(and(eq(paymentMethods.id, input.paymentMethodId), notDeleted(paymentMethods)))
		.limit(1);
	refuseUnless(Boolean(method), 'Choose how it was paid.', 'paymentMethodId');
	const transactionId = await insertReturningId(tx, transactions, {
		amount: input.amount,
		direction: 'out',
		paymentMethodId: input.paymentMethodId,
		paymentStatus: 'paid',
		occurredOn: clinicToday(),
		description: `Supplier invoice ${input.invoiceNo}${input.orderNumber ? ` for ${input.orderNumber}` : ''}`,
		branchId: input.branchId ?? event.locals.branch.active ?? undefined,
		createdBy: event.locals.user?.id
	});
	await recordAudit(tx, event, {
		table: 'transactions',
		recordId: transactionId,
		action: 'create'
	});
	await tx
		.update(supplierInvoice)
		.set({ transactionId, updatedBy: event.locals.user?.id })
		.where(eq(supplierInvoice.id, invoiceId));
	await recordAudit(tx, event, {
		table: 'supplier_invoice',
		recordId: invoiceId,
		action: 'update',
		before: { transactionId: null },
		after: { transactionId }
	});
}

/** Records a supplier's invoice against a sent order, and pays it now if a method is given. */
export async function recordSupplierInvoice(
	tx: Tx,
	event: Event,
	orderId: number,
	input: {
		invoiceNo: string;
		invoiceDate: string;
		amount: number;
		note: string | null;
		paymentMethodId: number | null;
	}
) {
	const order = await orderFor(tx, event.locals.branch, orderId);
	refuseUnless(
		order.status !== 'draft' && order.status !== 'cancelled',
		'A supplier invoices an order that was sent.'
	);
	refuseUnless(input.amount > 0, 'Give the invoice’s amount.', 'amount');
	refuseUnless(
		input.invoiceDate <= clinicToday(),
		'An invoice is dated today or before.',
		'invoiceDate'
	);
	const id = await insertReturningId(tx, supplierInvoice, {
		orderId,
		invoiceNo: input.invoiceNo.trim().slice(0, 60),
		invoiceDate: input.invoiceDate,
		amount: input.amount,
		note: input.note,
		createdBy: event.locals.user?.id
	});
	await recordAudit(tx, event, { table: 'supplier_invoice', recordId: id, action: 'create' });
	if (input.paymentMethodId !== null) {
		await payOut(tx, event, id, {
			amount: input.amount,
			paymentMethodId: input.paymentMethodId,
			invoiceNo: input.invoiceNo,
			orderNumber: order.number,
			branchId: order.branchId
		});
	}
}

/** Pays a supplier's invoice recorded earlier. Once only. */
export async function paySupplierInvoice(
	tx: Tx,
	event: Event,
	orderId: number,
	invoiceId: number,
	paymentMethodId: number
) {
	const order = await orderFor(tx, event.locals.branch, orderId);
	const [invoice] = await tx
		.select({
			id: supplierInvoice.id,
			amount: supplierInvoice.amount,
			invoiceNo: supplierInvoice.invoiceNo,
			transactionId: supplierInvoice.transactionId
		})
		.from(supplierInvoice)
		.where(
			and(
				eq(supplierInvoice.id, invoiceId),
				eq(supplierInvoice.orderId, orderId),
				notDeleted(supplierInvoice)
			)
		)
		.limit(1)
		.for('update');
	refuseUnless(Boolean(invoice), 'That invoice is not on this order.');
	refuseUnless(invoice.transactionId === null, 'This invoice is already paid.');
	await payOut(tx, event, invoiceId, {
		amount: invoice.amount,
		paymentMethodId,
		invoiceNo: invoice.invoiceNo,
		orderNumber: order.number,
		branchId: order.branchId
	});
}
