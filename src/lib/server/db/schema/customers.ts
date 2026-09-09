// customers-appointments.ts - Handles customers, appointments, and statuses (suggested new category for operations/client management)
import { relations } from 'drizzle-orm';
import { mysqlTable, varchar, int, date, decimal, year, mysqlEnum } from 'drizzle-orm/mysql-core';
import { secureFields, approvalFields } from './secureFields';

import { transactions } from './finance';
import { address } from './locations';
import { services } from './services';
import { employee } from './staff';

export const customers = mysqlTable('customers', {
	id: int('id').primaryKey().autoincrement(),
	name: varchar('name', { length: 200 }).notNull(),
	phone: varchar('phone', { length: 20 }).notNull(),
	email: varchar('email', { length: 100 }).notNull(),
	tinNo: varchar('tin_no', { length: 50 }).notNull().unique(),
	status: mysqlEnum('status', ['active', 'dead', 'pending', 'contracted']),
	address: int('address').references(() => address.id, { onDelete: 'set null' }),
	...secureFields,
	...approvalFields
});

export const customerContracts = mysqlTable('customer_contracts', {
	id: int('id').primaryKey().autoincrement(),
	customerId: int('customer_id')
		.notNull()
		.references(() => customers.id, { onDelete: 'cascade' }),
	contractType: varchar('contract_type', { length: 50 }).notNull(),
	contractAmount: decimal('contract_amount', { precision: 10, scale: 2 }).notNull(),
	contractYear: year('contract_year').notNull(),
	contractDate: date('contract_date').notNull(),
	contractFile: varchar('contract_file', { length: 255 }).notNull(),
	signingOfficer: int('signing_officer').references(() => employee.id, { onDelete: 'set null' }),

	...secureFields,
	...approvalFields
});

export const customerServices = mysqlTable('customer_services', {
	id: int('id').primaryKey().autoincrement(),
	customerId: int('customer_id')
		.notNull()
		.references(() => customers.id, { onDelete: 'cascade' }),
	serviceId: int('service_id').references(() => services.id),
	startDate: date('service_start_date').notNull(),
	endDate: date('service_end_date'),
	endReason: varchar('service_end_reason', { length: 50 }),
	...secureFields
});

export const customerPenalties = mysqlTable('customer_penalties', {
	id: int('id').primaryKey().autoincrement(),
	customerId: int('customer_id')
		.notNull()
		.references(() => customers.id, { onDelete: 'cascade' }),
	penaltyType: varchar('penalty_type', { length: 50 }).notNull(),
	penaltyAmount: decimal('penalty_amount', { precision: 10, scale: 2 }).notNull(),
	penaltyDate: date('penalty_date').notNull(),
	transactionId: int('transaction_id')
		.notNull()
		.references(() => transactions.id, { onDelete: 'cascade' }),
	...secureFields
});

export const customerMonthlyPayments = mysqlTable('customer_monthly_payments', {
	id: int('id').primaryKey().autoincrement(),
	customerId: int('customer_id')
		.notNull()
		.references(() => customers.id, { onDelete: 'cascade' }),
	paymentType: varchar('payment_type', { length: 50 }).notNull(),
	paymentAmount: decimal('payment_amount', { precision: 10, scale: 2 }).notNull(),
	paymentMonth: int('payment_month').notNull(),
	paymentDate: date('payment_date').notNull(),
	transactionId: int('transaction_id')
		.notNull()
		.references(() => transactions.id, { onDelete: 'cascade' }),
	...secureFields
});

export const customerPayments = mysqlTable('customer_payments', {
	id: int('id').primaryKey().autoincrement(),
	customerId: int('customer_id')
		.notNull()
		.references(() => customers.id, { onDelete: 'cascade' }),
	paymentType: varchar('payment_type', { length: 50 }).notNull(),
	paymentAmount: decimal('payment_amount', { precision: 10, scale: 2 }).notNull(),
	paymentDate: date('payment_date').notNull(),
	transactionId: int('transaction_id')
		.notNull()
		.references(() => transactions.id, { onDelete: 'cascade' }),
	...secureFields
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

export const commisionAgents = mysqlTable('commission_registers', {
	id: int('id').primaryKey().autoincrement(),
	name: varchar('name', { length: 200 }).notNull(),
	phone: varchar('phone', { length: 20 }).notNull(),
	email: varchar('email', { length: 100 }).notNull(),
	feedback: varchar('feedback', { length: 255 }).notNull(),
	contactedBy: int('contacted_by').references(() => employee.id, { onDelete: 'set null' }),
	tinNo: varchar('tin_no', { length: 50 }).notNull(),
	address: int('address').references(() => address.id, { onDelete: 'set null' }),
	...secureFields
});
