// inventory.ts - Handles products, supplies, categories, and inventory adjustments

import { mysqlTable, mysqlEnum, varchar, int, decimal, boolean } from 'drizzle-orm/mysql-core';
import { secureFields, lesserFields, deletionFields } from './secureFields';

import { transactionSupplies } from './finance';
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
	quantity: int('quantity').notNull().default(0),
	unitOfMeasure: varchar('unit_of_measure', { length: 20 }),
	reorderLevel: int('reorder_level'),
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
	 * Whether this item is received and consumed in lots with expiry dates.
	 *
	 * Per item rather than assumed, because it is not free: a tracked item means every receipt
	 * creates a batch and every issue has to choose one. True for medicines, anaesthetic, composite
	 * and impression material; false for burs, mirrors and paper bibs, which never expire and
	 * would only generate rows nobody reads.
	 */
	tracksBatches: boolean('tracks_batches').notNull().default(false),
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
	quantity: int('quantity').notNull(),
	damagedBy: int('damaged_by').references(() => employee.id),
	deductable: boolean('deductable').notNull().default(false),
	reason: varchar('reason', { length: 255 }).notNull(),
	...secureFields
});

/**
 * The stock movement ledger.
 *
 * Every change to a quantity is a row here, and `supplies.quantity` is the running total the
 * write path keeps alongside it. The columns below were added to turn a general adjustment log
 * into something a pharmacy can answer questions from: which lot a movement came out of, and who
 * it was dispensed to.
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
	adjustment: int('adjustment').notNull(), // e.g., +50 for new stock, -1 for a sale, -1 for internal use
	supplierId: int('supplier_id').references(() => supplySuppliers.id),
	employeeResponsible: int('employee_responsible').references(() => employee.id),
	reason: varchar('reason', { length: 255 }),
	costPerItem: decimal('cost_per_item', { precision: 10, scale: 2 }),
	total: decimal('total', { precision: 10, scale: 2 }),
	transactionId: int('transaction_id').references(() => transactionSupplies.id, {
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
