// batches.ts - Stock that expires, tracked by the lot it came in.
import {
	mysqlTable,
	mysqlEnum,
	varchar,
	int,
	decimal,
	date,
	text,
	index
} from 'drizzle-orm/mysql-core';
import { relations } from 'drizzle-orm';
import { secureFields } from './secureFields';
import { branchRef } from './branches';
import { supplies, supplySuppliers } from './inventory';

/**
 * One delivery of one item, with the expiry date that came on the box.
 *
 * **The gap this fills is an expiry date per lot rather than per item.** A clinic receives
 * amoxicillin in March expiring 2028 and again in June expiring 2029, and `supplies` can hold one
 * quantity but not two expiry dates. Without batches the only honest answer to "is any of this
 * expired" is "look in the cupboard", which is how expired stock gets dispensed.
 *
 * It is not only medicines. Composite, impression material and anaesthetic cartridges all carry
 * expiry dates and all get used past them if nobody is counting, so `supplies.tracksBatches`
 * decides per item rather than the table assuming.
 *
 * **`quantity` here is what remains in this lot, and it is the only place stock is recorded.**
 * `supplies` has no quantity column: the figure every screen shows is the sum of an item's open
 * lots, computed by `onHand()` in `server/stock.ts`. There is no cached total to reconcile
 * against, and therefore nothing that can quietly disagree about stock somebody is about to
 * dispense.
 *
 * Non-goal: enforcing that a batch number is unique. Receiving the same lot twice is a real
 * second delivery, and a clinic that puts them on one row and a clinic that puts them on two are
 * both right.
 */
export const supplyBatch = mysqlTable(
	'supply_batch',
	{
		id: int('id').primaryKey().autoincrement(),

		supplyId: int('supply_id')
			.notNull()
			.references(() => supplies.id, { onDelete: 'cascade' }),

		/** The manufacturer's lot number, as printed. What a recall names. */
		batchNumber: varchar('batch_number', { length: 60 }),

		/**
		 * The date on the box. The reason this table exists, and indexed for the two questions a
		 * clinic asks of it: what has expired, and what expires next month.
		 */
		expiryDate: date('expiry_date'),

		/** What remains. Decimal because materials come in millilitres and grams, not just boxes. */
		quantity: decimal('quantity', { precision: 10, scale: 2, mode: 'number' }).notNull().default(0),

		/** What arrived, kept so consumption is visible without replaying the ledger. */
		receivedQuantity: decimal('received_quantity', { precision: 10, scale: 2, mode: 'number' }),

		/** What this lot cost per unit — the same item from two suppliers is two prices. */
		unitCost: decimal('unit_cost', { precision: 10, scale: 2, mode: 'number' }),

		supplierId: int('supplier_id').references(() => supplySuppliers.id, { onDelete: 'set null' }),
		receivedOn: date('received_on'),

		/**
		 * `active`      — usable
		 * `depleted`    — used up, kept for traceability rather than deleted
		 * `expired`     — past its date and pulled from use
		 * `quarantined` — held back pending a decision: a recall, damage in transit, a doubt
		 * `returned`    — sent back to the supplier
		 *
		 * `quarantined` is the one worth having. A recall notice arrives naming a lot number, and
		 * the clinic needs somewhere to put it that is neither "in use" nor "gone".
		 */
		status: mysqlEnum('status', ['active', 'depleted', 'expired', 'quarantined', 'returned'])
			.notNull()
			.default('active'),

		branchId: branchRef(),
		note: text('note'),

		...secureFields
	},
	(table) => [
		// "What expires next month" and "what has already expired" — both run off this.
		index('supply_batch_expiry_idx').on(table.expiryDate, table.status),
		index('supply_batch_supply_idx').on(table.supplyId, table.status),
		// A recall names a lot number and nothing else.
		index('supply_batch_number_idx').on(table.batchNumber)
	]
);

export const supplyBatchRelations = relations(supplyBatch, ({ one }) => ({
	supply: one(supplies, { fields: [supplyBatch.supplyId], references: [supplies.id] }),
	supplier: one(supplySuppliers, {
		fields: [supplyBatch.supplierId],
		references: [supplySuppliers.id]
	})
}));
