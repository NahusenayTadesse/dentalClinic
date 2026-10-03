// inventory.ts - Handles products, supplies, categories, and inventory adjustments

import { mysqlTable, mysqlEnum, varchar, int, decimal, boolean } from 'drizzle-orm/mysql-core';
import { secureFields, lesserFields, deletionFields } from './secureFields';

import { transactions } from './finance';
import { employee } from './staff';
import { address } from './locations';
import { medicine, prescription } from './prescriptions';
import { patient } from './patients';
import { supplyBatch } from './batches';
import { branchRef } from './branches';

export const supplyTypes = mysqlTable('supply_types', {
	id: int('id').primaryKey().autoincrement(),
	name: varchar('name', { length: 50 }).notNull(),
	description: varchar('description', { length: 255 }),
	...deletionFields
});
export const supplies = mysqlTable('supplies', {
	id: int('id').primaryKey().autoincrement(),
	supplyTypeId: int('supply_type_id')
		.notNull()
		.references(() => supplyTypes.id),
	name: varchar('name', { length: 50 }).notNull(),
	description: varchar('description', { length: 255 }),
	unitOfMeasure: varchar('unit_of_measure', { length: 20 }),
	/**
	 * Decimal, like every other quantity here. A clinic that stocks composite by the millilitre or
	 * alginate by the gram has a reorder level in the same units, and an integer would round it to
	 * something that never triggers or always does.
	 */
	reorderLevel: decimal('reorder_level', { precision: 10, scale: 2, mode: 'number' }),
	// Whether this item is expected back once issued out. Consumables (gloves,
	// anaesthetic, impression material) are false and are written off on issue;
	// instruments and equipment are true and are chased for return.
	returnable: boolean('returnable').notNull().default(false),

	/**
	 * The formulary entry this stock *is*, when it is a medicine.
	 *
	 * Null for gloves, composite and burs — most of this table. Set for anything the clinic
	 * dispenses, and that link is what stops the pharmacy being a second, parallel drug list: the
	 * drug's identity, its form and strength and its three dental risk flags live once in
	 * `medicine`, shared with prescriptions and with what patients are already taking, while the
	 * physical stock of it lives here.
	 *
	 * They stay separate tables because they answer different questions. A medicine the clinic
	 * prescribes but does not stock — the patient takes the script to a pharmacy — has a
	 * `medicine` row and no `supplies` row at all, and forcing them together would mean inventing
	 * stock records for drugs nobody holds.
	 */
	medicineId: int('medicine_id').references(() => medicine.id, { onDelete: 'set null' }),

	/**
	 * Whether an expiry date is expected on each lot of this item.
	 *
	 * **Not whether lots exist** — every supply has lots now, because the quantity is derived from
	 * them and an item with none would read as zero. A delivery of burs is a lot with no expiry
	 * date. This flag is what makes the expiry field required on receipt for medicines,
	 * anaesthetic, composite and impression material, and absent for mirrors and paper bibs.
	 */
	tracksExpiry: boolean('tracks_expiry').notNull().default(false),
	/**
	 * Where this stock physically sits. Quantity is per-row, so a second branch holding the same
	 * item is a second row rather than a shared count. See `branchRef`.
	 */
	branchId: branchRef(),
	...secureFields
});

export const damagedSupplies = mysqlTable('damaged_supplies', {
	id: int('id').primaryKey().autoincrement(),
	supplyId: int('supply_id')
		.notNull()
		.references(() => supplies.id),
	/** Decimal: damage is measured in whatever the item is measured in — half a bottle is real. */
	quantity: decimal('quantity', { precision: 10, scale: 2, mode: 'number' }).notNull(),
	damagedBy: int('damaged_by').references(() => employee.id),
	deductable: boolean('deductable').notNull().default(false),
	reason: varchar('reason', { length: 255 }).notNull(),
	...secureFields
});

/**
 * The stock movement ledger — the audit of how stock got to where it is.
 *
 * It is no longer what the quantity is computed from. Stock on hand is the sum of open lots (see
 * `server/stock.ts`), and this records *why* each lot changed: which one, what kind of movement,
 * and for a dispense, to which patient and against which prescription.
 *
 * That split is deliberate. Summing this table to get a quantity was measured at 67.6 ms against
 * 1.6 ms for summing lots, and unlike lots it grows forever — every dispense for the life of the
 * clinic. It is written once and read for history, not for arithmetic.
 */
export const suppliesAdjustments = mysqlTable('supplies_adjustments', {
	id: int('id').autoincrement().primaryKey(),
	/**
	 * What kind of movement this was.
	 *
	 * `reason` below is prose and always was; this is the same fact in a form a report can group
	 * by. Without it "how much did we dispense this month" and "how much did we write off" are
	 * both a `LIKE` over a free-text field, which is the mistake the allergy column made.
	 *
	 * Defaults to `correction` because that is what an unlabelled adjustment historically was —
	 * somebody counted the shelf and fixed the number.
	 */
	movementType: mysqlEnum('movement_type', [
		'received',
		'dispensed',
		'consumed',
		'damaged',
		'expired',
		'returned',
		'transferred',
		'correction'
	])
		.notNull()
		.default('correction'),

	suppliesId: int('supplies_id')
		.notNull()
		.references(() => supplies.id),
	/**
	 * Signed: positive receives, negative issues. Decimal rather than integer, because the lot it
	 * moves is decimal and a movement that cannot express half a bottle would silently round the
	 * quantity it is supposed to explain.
	 */
	adjustment: decimal('adjustment', { precision: 10, scale: 2, mode: 'number' }).notNull(), // e.g., +50 for new stock, -1 for a sale, -1 for internal use
	supplierId: int('supplier_id').references(() => supplySuppliers.id),
	employeeResponsible: int('employee_responsible').references(() => employee.id),
	reason: varchar('reason', { length: 255 }),
	costPerItem: decimal('cost_per_item', { precision: 10, scale: 2 }),
	total: decimal('total', { precision: 10, scale: 2 }),
	/**
	 * The payment this movement was part of, for a purchase.
	 *
	 * Points at `transactions`, which is what the write path has always stored here. It used to
	 * reference `transaction_supplies` (since dropped) — the line item rather than the payment — while the adjust
	 * action wrote a `transactions.id` into it. Two auto-increment sequences starting at 1 overlap
	 * for a long time, so the foreign key accepted the wrong id silently and the change-history
	 * page joined through to whichever receipt happened to share the number. It would have
	 * started failing outright once the two tables drifted apart.
	 */
	transactionId: int('transaction_id').references(() => transactions.id, {
		onDelete: 'set null'
	}), //if the adjustment is caused by new stuff coming in
	/**
	 * Which lot the stock came out of. Null for items that do not track batches.
	 *
	 * `set null` rather than cascade: a depleted batch may eventually be tidied away, and the
	 * movements that emptied it are the traceability — losing them to keep the parent tidy is the
	 * wrong trade. A recall works backwards through exactly this column.
	 */
	batchId: int('batch_id').references(() => supplyBatch.id, { onDelete: 'set null' }),

	/**
	 * Who it was dispensed to, and against which prescription.
	 *
	 * Both null for everything that is not a dispense — a delivery, a breakage, a stock count. Set
	 * together, they are what makes a recall actionable: a lot number arrives in a notice, and
	 * this says which patients received it.
	 */
	patientId: int('patient_id').references(() => patient.id, { onDelete: 'set null' }),
	prescriptionId: int('prescription_id').references(() => prescription.id, {
		onDelete: 'set null'
	}),

	damagedSuppliesId: int('damaged_supplies_id').references(() => damagedSupplies.id, {
		onDelete: 'set null'
	}),

	/**
	 * The order line a delivery was received against, so an order knows what has arrived and a
	 * lot knows which order brought it. Plain int, not a reference: `purchasing.ts` imports this
	 * file, and the reference would be a cycle.
	 */
	purchaseOrderLineId: int('purchase_order_line_id'),
	...secureFields
});

export const supplySuppliers = mysqlTable('supply_suppliers', {
	id: int('id').primaryKey().autoincrement(),
	name: varchar('name', { length: 50 }).notNull(),
	phone: varchar('phone', { length: 20 }).notNull(),
	email: varchar('email', { length: 100 }),
	description: varchar('description', { length: 255 }),
	address: int('address').references(() => address.id, {
		onDelete: 'set null'
	}),
	...lesserFields
});
