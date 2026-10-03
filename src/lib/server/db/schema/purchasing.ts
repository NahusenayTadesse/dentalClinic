// purchasing.ts - Orders to suppliers, what arrived against them, and the suppliers' invoices.
import {
	mysqlTable,
	mysqlEnum,
	int,
	varchar,
	date,
	decimal,
	text,
	index,
	uniqueIndex
} from 'drizzle-orm/mysql-core';
import { secureFields } from './secureFields';
import { branchRef } from './branches';
import { supplies, supplySuppliers } from './inventory';
import { transactions } from './finance';

/**
 * An order to a supplier. A draft is edited freely; sending it gives it its number (`PO-2019-…`)
 * and fixes its lines. Deliveries are received against its lines into the stock lots
 * (`server/purchasing.ts`), and `status` follows what has arrived. The rules are
 * `$lib/purchasing.ts`'s.
 */
export const purchaseOrder = mysqlTable(
	'purchase_order',
	{
		id: int('id').primaryKey().autoincrement(),
		/** Given when the order is sent; a draft has none. */
		number: varchar('number', { length: 30 }),
		supplierId: int('supplier_id')
			.notNull()
			.references(() => supplySuppliers.id),
		branchId: branchRef(),
		status: mysqlEnum('status', ['draft', 'sent', 'partly', 'received', 'cancelled'])
			.notNull()
			.default('draft'),
		orderedOn: date('ordered_on', { mode: 'string' }),
		expectedOn: date('expected_on', { mode: 'string' }),
		note: text('note'),
		...secureFields
	},
	(table) => [
		uniqueIndex('purchase_order_number_unique').on(table.number),
		index('purchase_order_branch_status_idx').on(table.branchId, table.status)
	]
);

/** One item ordered: how many, at what price, and how many have arrived so far. */
export const purchaseOrderLine = mysqlTable(
	'purchase_order_line',
	{
		id: int('id').primaryKey().autoincrement(),
		orderId: int('order_id')
			.notNull()
			.references(() => purchaseOrder.id),
		supplyId: int('supply_id')
			.notNull()
			.references(() => supplies.id),
		quantity: decimal('quantity', { precision: 10, scale: 2, mode: 'number' }).notNull(),
		unitCost: decimal('unit_cost', { precision: 10, scale: 2, mode: 'number' }),
		/** Kept with each delivery received against the line (`receivePurchase`). */
		received: decimal('received', { precision: 10, scale: 2, mode: 'number' }).notNull().default(0),
		...secureFields
	},
	(table) => [index('purchase_order_line_order_idx').on(table.orderId)]
);

/**
 * A supplier's invoice for an order: their number, their date, their amount, and — once paid — the
 * money that left (`transactionId`). Matched against what was ordered and what arrived before it
 * is paid (`$lib/purchasing.ts`).
 */
export const supplierInvoice = mysqlTable(
	'supplier_invoice',
	{
		id: int('id').primaryKey().autoincrement(),
		orderId: int('order_id')
			.notNull()
			.references(() => purchaseOrder.id),
		invoiceNo: varchar('invoice_no', { length: 60 }).notNull(),
		invoiceDate: date('invoice_date', { mode: 'string' }).notNull(),
		amount: decimal('amount', { precision: 12, scale: 2, mode: 'number' }).notNull(),
		transactionId: int('transaction_id').references(() => transactions.id, {
			onDelete: 'set null'
		}),
		note: varchar('note', { length: 255 }),
		...secureFields
	},
	(table) => [index('supplier_invoice_order_idx').on(table.orderId)]
);
