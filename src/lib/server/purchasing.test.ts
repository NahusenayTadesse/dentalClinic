import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';

import { db } from './db';
import {
	paymentMethods,
	purchaseOrder,
	purchaseOrderLine,
	supplierInvoice,
	supplies,
	supplySuppliers,
	supplyTypes,
	user
} from './db/schema';
import { inRollback } from '$lib/testing/rollback';
import { WriteRefused } from './childCrud';
import { insertReturningId } from '@nahu/admin-kit/server/db/insert.js';
import { onHand } from './stock';
import {
	cancelOrder,
	draftOrder,
	paySupplierInvoice,
	receivePurchase,
	recordSupplierInvoice,
	saveDraft,
	sendOrder
} from './purchasing';

/**
 * An order's life: drafted, sent and numbered, received in parts into the lots (never more than
 * is outstanding), invoiced and paid once. Built inside rollbacks, with an item of its own; a
 * supplier, a supply type, a payment method and a user are borrowed.
 */
describe('purchasing', async () => {
	const [supplier] = await db.select({ id: supplySuppliers.id }).from(supplySuppliers).limit(1);
	const [type] = await db.select({ id: supplyTypes.id }).from(supplyTypes).limit(1);
	const [method] = await db.select({ id: paymentMethods.id }).from(paymentMethods).limit(1);
	const [clerk] = await db.select({ id: user.id }).from(user).limit(1);
	const ready = Boolean(supplier && type && method && clerk);

	const event = {
		locals: { user: clerk ? { id: clerk.id } : null, branch: { active: null } },
		getClientAddress: () => '127.0.0.1'
	};

	const refused = async (write: Promise<unknown>) => {
		try {
			await write;
		} catch (err) {
			if (err instanceof WriteRefused) return err.message;
			throw err;
		}
		return null;
	};

	it.skipIf(!ready)('sends, receives in parts, and pays the supplier once', async () => {
		const result = await inRollback(async (tx) => {
			const item = await insertReturningId(tx, supplies, {
				supplyTypeId: type.id,
				name: 'Test gloves',
				unitOfMeasure: 'box'
			});
			const orderId = await draftOrder(tx, event, supplier.id);
			const emptySend = await refused(sendOrder(tx, event, orderId));
			await saveDraft(tx, event, orderId, {
				lines: [{ supplyId: item, quantity: 10, unitCost: 120 }],
				expectedOn: null,
				note: null
			});
			const number = await sendOrder(tx, event, orderId);
			const editSent = await refused(
				saveDraft(tx, event, orderId, { lines: [], expectedOn: null, note: null })
			);
			const [line] = await tx
				.select({ id: purchaseOrderLine.id })
				.from(purchaseOrderLine)
				.where(eq(purchaseOrderLine.orderId, orderId));

			await receivePurchase(tx, event, orderId, {
				lineId: line.id,
				quantity: 4,
				batchNumber: null,
				expiryDate: null
			});
			const [partly] = await tx
				.select({ status: purchaseOrder.status })
				.from(purchaseOrder)
				.where(eq(purchaseOrder.id, orderId));
			const tooMany = await refused(
				receivePurchase(tx, event, orderId, {
					lineId: line.id,
					quantity: 7,
					batchNumber: null,
					expiryDate: null
				})
			);
			await receivePurchase(tx, event, orderId, {
				lineId: line.id,
				quantity: 6,
				batchNumber: null,
				expiryDate: null
			});
			const [full] = await tx
				.select({ status: purchaseOrder.status })
				.from(purchaseOrder)
				.where(eq(purchaseOrder.id, orderId));
			const [stock] = await tx
				.select({ onHand: onHand() })
				.from(supplies)
				.where(eq(supplies.id, item));
			const cancelReceived = await refused(cancelOrder(tx, event, orderId));

			await recordSupplierInvoice(tx, event, orderId, {
				invoiceNo: 'SUP-77',
				invoiceDate: '2026-01-01',
				amount: 1200,
				note: null,
				paymentMethodId: method.id
			});
			const [invoice] = await tx
				.select({ id: supplierInvoice.id, transactionId: supplierInvoice.transactionId })
				.from(supplierInvoice)
				.where(eq(supplierInvoice.orderId, orderId));
			const payTwice = await refused(paySupplierInvoice(tx, event, orderId, invoice.id, method.id));

			return {
				emptySend,
				number,
				editSent,
				partly: partly.status,
				tooMany,
				full: full.status,
				onHand: Number(stock.onHand),
				cancelReceived,
				paid: invoice.transactionId !== null,
				payTwice
			};
		});

		expect(result.emptySend).toMatch(/Add what is being ordered/);
		expect(result.number).toMatch(/^PO-\d{4}-\d{5}$/);
		expect(result.editSent).toMatch(/not changed/);
		expect(result.partly).toBe('partly');
		expect(result.tooMany).toMatch(/Only 6 are still to come/);
		expect(result.full).toBe('received');
		expect(result.onHand).toBe(10);
		expect(result.cancelReceived).toMatch(/cannot be cancelled/);
		expect(result.paid).toBe(true);
		expect(result.payTwice).toMatch(/already paid/);
	});
});
