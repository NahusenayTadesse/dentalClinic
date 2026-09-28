// Customers and how to reach them.
//
// The contract, monthly-payment and penalty tables that used to live here were the facilities
// business's client billing; they went with the prune.
import { mysqlTable, varchar, int, mysqlEnum } from 'drizzle-orm/mysql-core';
import { secureFields, approvalFields } from './secureFields';
import { address } from './locations';

export const customers = mysqlTable('customers', {
	id: int('id').primaryKey().autoincrement(),
	name: varchar('name', { length: 200 }).notNull(),
	phone: varchar('phone', { length: 20 }).notNull(),
	// Nullable: an employer's accounts office may be reachable only by phone, and the add form never
	// required one — it inserted `undefined` into a NOT NULL column instead (migration 0040).
	email: varchar('email', { length: 100 }),
	tinNo: varchar('tin_no', { length: 50 }).notNull().unique(),
	status: mysqlEnum('status', ['active', 'dead', 'pending', 'contracted']),
	address: int('address').references(() => address.id, { onDelete: 'set null' }),
	...secureFields,
	...approvalFields
});

export const customerContacts = mysqlTable('customer_contacts', {
	id: int('id').primaryKey().autoincrement(),
	customerId: int('customer_id')
		.notNull()
		.references(() => customers.id, { onDelete: 'cascade' }),
	contactType: varchar('contact_type', { length: 50 }).notNull(),
	contactDetail: varchar('contact_detail', { length: 255 }).notNull(),
	...secureFields
});
