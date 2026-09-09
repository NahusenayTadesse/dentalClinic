// Physical locations, and who to call at each one.
//
// The contract, invoice and penalty tables that used to live here belonged to the facilities
// business this app was repurposed from — a `site` was the client's premises. A clinic site is
// its own branch, so the billing hangs off patients instead.
import { mysqlTable, int, varchar, boolean, date } from 'drizzle-orm/mysql-core';
import { secureFields, approvalFields } from './secureFields';
import { customers } from './customers';
import { address } from './locations';

export const site = mysqlTable('site', {
	id: int('id').primaryKey().autoincrement(),
	name: varchar('name', { length: 50 }).notNull(),
	phone: varchar('phone', { length: 20 }).notNull(),
	customerId: int('customer_id')
		.notNull()
		.references(() => customers.id),
	address: int('address')
		.notNull()
		.references(() => address.id),
	startDate: date('start_date').notNull(),
	officeCommission: boolean('office_commission').notNull().default(true),
	...secureFields,
	...approvalFields
});

export const siteContacts = mysqlTable('site_contacts', {
	id: int('id').primaryKey().autoincrement(),
	siteId: int('site_id')
		.notNull()
		.references(() => site.id, { onDelete: 'cascade' }),
	contactType: varchar('contact_type', { length: 50 }).notNull(),
	contactDetail: varchar('contact_detail', { length: 255 }).notNull(),
	...secureFields
});
