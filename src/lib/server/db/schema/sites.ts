// Updated subcity snippet

import {
	mysqlTable,
	int,
	varchar,
	boolean,
	date,
	decimal,
	uniqueIndex,
	year,
	datetime,
	mysqlEnum
} from 'drizzle-orm/mysql-core';
import { secureFields, approvalFields } from './secureFields';
import { customers } from './customers';
import { address } from './locations';
import { employee } from './staff';
import { services } from './services';
import { transactions } from './finance';
import { user } from './user';

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

export const siteContracts = mysqlTable('site_contracts', {
	id: int('id').primaryKey().autoincrement(),
	siteId: int('site_id')
		.notNull()
		.references(() => site.id, { onDelete: 'cascade' }),
	customerId: int('customer_id')
		.notNull()
		.references(() => customers.id, { onDelete: 'cascade' }),
	monthlyAmount: decimal('contract_amount', { precision: 10, scale: 2 }).notNull(),
	serviceId: int('service_id').references(() => services.id),
	contractYear: year('contract_year').notNull(),
	contractDate: date('contract_date').notNull(),
	startDate: date('start_date').notNull(),
	endDate: date('end_date').notNull(),
	contractFile: varchar('contract_file', { length: 255 }).notNull(),
	commissionConsidered: boolean('commission_considered').notNull().default(true),
	terminated: boolean('terminated').notNull().default(false),
	terminationDate: date('termination_date'),
	terminationReason: varchar('termination_reason', { length: 255 }),
	inActiveReason: varchar('inactive_reason', { length: 255 }),
	signingOfficer: int('signing_officer').references(() => employee.id, { onDelete: 'set null' }),
	...secureFields,
	...approvalFields
});

export const contractRenewals = mysqlTable('contract_renewals', {
	id: int('id').primaryKey().autoincrement(),
	contractId: int('contract_id')
		.notNull()
		.references(() => siteContracts.id, { onDelete: 'cascade' }),
	renewalDate: date('renewal_date').notNull(),
	renewalStartDate: date('renewal_start_date').notNull(),
	renewalEndDate: date('renewal_end_date').notNull(),
	renewalAmount: decimal('renewal_amount', { precision: 10, scale: 2 }).notNull(),
	signingOfficer: int('signing_officer').references(() => employee.id, { onDelete: 'set null' }),
	contractFile: varchar('contract_file', { length: 255 }),

	...secureFields
});

export const siteMonthlyPayments = mysqlTable('site_monthly_payments', {
	id: int('id').primaryKey().autoincrement(),

	contractId: int('contract_id')
		.notNull()
		.references(() => siteContracts.id, { onDelete: 'cascade' }),
	paymentRequestFile: varchar('payment_request_file', { length: 255 }),
	penaltyAmount: decimal('penalty_amount', { precision: 10, scale: 2 }).notNull().default('0'),
	fsNumber: varchar('fs_number', { length: 255 }).notNull(),
	invoiceNumber: varchar('invoice_number', { length: 255 }).notNull(),
	requestAmount: decimal('request_amount', { precision: 10, scale: 2 }).notNull(),
	requestChangeReason: varchar('request_change_amount', { length: 255 }),
	paymentAmount: decimal('payment_amount', { precision: 10, scale: 2 }).notNull(),
	beforeVat: decimal('before_Vat', { precision: 10, scale: 2 }).notNull(),
	vat: decimal('vat', { precision: 10, scale: 2 }).notNull().default('15'),
	withholdAmount: decimal('withhold_amount', { precision: 10, scale: 2 }),
	withholdFile: varchar('withhold_file', { length: 255 }),
	withholdInvoiceNumber: varchar('withhold_invoice_number', { length: 255 }),
	month: mysqlEnum('month', [
		'መስከረም', // Meskerem
		'ጥቅምት', // Tikimt
		'ህዳር', // Hidar
		'ታህሳስ', // Tahsas
		'ጥር', // Tir
		'የካቲት', // Yekatit
		'መጋቢት', // Megabit
		'ሚያዝያ', // Miyazya
		'ግንቦት', // Ginbot
		'ሰኔ', // Sene
		'ሐምሌ', // Hamle
		'ነሐሴ' // Nehasse
	]).notNull(),
	year: year('year').notNull(),
	date: date('date').notNull(),
	status: mysqlEnum('status', ['pending', 'approved', 'rejected']).default('pending'),
	approvedBy: varchar('user_id', { length: 255 }).references(() => user.id, {
		onDelete: 'set null'
	}),
	transactionId: int('transaction_id')
		.notNull()
		.references(() => transactions.id, { onDelete: 'cascade' }),
	...secureFields
});

export const sitePaymentAdjustment = mysqlTable('site_payment_adjustment', {
	id: int('id').primaryKey().autoincrement(),
	siteId: int('site_id')
		.notNull()
		.references(() => site.id),
	amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
	...secureFields
});

export const sitePenalties = mysqlTable('site_penalties', {
	id: int('id').primaryKey().autoincrement(),
	contractId: int('contract_id').references(() => siteContracts.id, { onDelete: 'cascade' }),
	penaltyReason: varchar('penalty_type', { length: 255 }).notNull(),
	penaltyLetter: varchar('penalty_letter', { length: 255 }),
	penaltyAmount: decimal('penalty_amount', { precision: 10, scale: 2 }).notNull(),
	penaltyDate: date('penalty_date').notNull(),
	month: mysqlEnum('month', [
		'መስከረም', // Meskerem
		'ጥቅምት', // Tikimt
		'ህዳር', // Hidar
		'ታህሳስ', // Tahsas
		'ጥር', // Tir
		'የካቲት', // Yekatit
		'መጋቢት', // Megabit
		'ሚያዝያ', // Miyazya
		'ግንቦት', // Ginbot
		'ሰኔ', // Sene
		'ሐምሌ', // Hamle
		'ነሐሴ' // Nehasse
	]).notNull(),
	year: year('year').notNull(),

	...secureFields
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

export const paymentRequest = mysqlTable(
	'payment_request',
	{
		id: int('id').primaryKey().autoincrement(),
		siteId: int('site_id')
			.notNull()
			.references(() => site.id, { onDelete: 'cascade' }),
		contractId: int('contract_id').references(() => siteContracts.id, { onDelete: 'cascade' }),
		invoiceNumber: varchar('invoice_number', { length: 255 }).notNull(),
		requestDate: date('request_date').notNull(),
		vat: decimal('vat', { precision: 10, scale: 2 }).notNull().default('15'),
		withholding: decimal('withholding', { precision: 10, scale: 2 }).notNull().default('3'),
		amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
		month: mysqlEnum('month', [
			'መስከረም', // Meskerem
			'ጥቅምት', // Tikimt
			'ህዳር', // Hidar
			'ታህሳስ', // Tahsas
			'ጥር', // Tir
			'የካቲት', // Yekatit
			'መጋቢት', // Megabit
			'ሚያዝያ', // Miyazya
			'ግንቦት', // Ginbot
			'ሰኔ', // Sene
			'ሐምሌ', // Hamle
			'ነሐሴ' // Nehasse
		]).notNull(),
		year: year('year').notNull(),
		penality: decimal('penality', { precision: 10, scale: 2 }).notNull().default('0'),
		requestedBy: int('requested_by').references(() => employee.id, { onDelete: 'set null' }),
		rejectedReason: varchar('rejected_reason', { length: 255 }),
		approvedBy: int('approved_by').references(() => employee.id, { onDelete: 'set null' }),
		status: mysqlEnum('status', ['pending', 'approved', 'rejected']).notNull().default('pending'),
		/**
		 * When the status last moved to approved / rejected. `updatedAt` cannot stand in
		 * for these: it moves on any edit, so a re-touched old request would sort as the
		 * newest approval. Mirrors `approvedAt`/`rejectedAt` in `approvalFields`, which
		 * this table predates and does not use.
		 */
		approvedAt: datetime('approved_at'),
		rejectedAt: datetime('rejected_at'),

		...secureFields
	},
	// One request per site per month. Was keyed on `contractId`, which no write path
	// ever set — every row had NULL there, MySQL skips NULLs in a unique index, and the
	// constraint silently allowed unlimited duplicates. A request covers a whole site,
	// across all of its contracts, so `siteId` is the column that actually identifies it.
	(table) => [uniqueIndex('unique_payment_per_month').on(table.siteId, table.month, table.year)]
);
