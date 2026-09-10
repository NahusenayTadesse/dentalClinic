// inventory.ts - Handles products, supplies, categories, and inventory adjustments

import { mysqlTable, varchar, int, decimal, boolean } from 'drizzle-orm/mysql-core';
import { secureFields, lesserFields, deletionFields } from './secureFields';

import { transactionSupplies } from './finance';
import { employee } from './staff';
import { address } from './locations';
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

export const suppliesAdjustments = mysqlTable('supplies_adjustments', {
	id: int('id').autoincrement().primaryKey(),
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
