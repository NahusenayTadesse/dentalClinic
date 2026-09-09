// finance.ts - Handles sales, expenses, payroll, and other money-related transactions
import { relations } from 'drizzle-orm';
import {
	mysqlTable,
	mysqlEnum,
	varchar,
	int,
	decimal,
	date,
	year,
	unique,
	index,
	boolean,
	datetime
} from 'drizzle-orm/mysql-core';
import { employee } from './staff';
import { secureFields, approvalFields } from './secureFields';
import { services } from './services';
import { supplies } from '../schema';
import { user } from './user';

export const paymentMethods = mysqlTable('payment_methods', {
	id: int('id').primaryKey().autoincrement(),
	name: varchar('name', { length: 100 }).notNull().unique(),
	description: varchar('description', { length: 255 }),
	...secureFields
});

export const bankAmount = mysqlTable('bank_amount', {
	id: int('id').primaryKey().autoincrement(),
	paymentMethodId: int('payment_method_id')
		.references(() => paymentMethods.id, {
			onDelete: 'set null'
		})
		.unique(),
	account: varchar('account', { length: 100 }).notNull().default('No Account Number'),
	amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
	...secureFields
});

export const bankInsertHistory = mysqlTable('bank_insert_history', {
	id: int('id').primaryKey().autoincrement(),
	bankAmountId: int('bank_amount_id').references(() => bankAmount.id, {
		onDelete: 'set null'
	}),
	amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
	transactionId: int('transaction_id')
		.notNull()
		.references(() => transactions.id, { onDelete: 'set null' }),
	reason: varchar('reason', { length: 255 }),
	...secureFields
});

export const vatAndWithHold = mysqlTable('vat_and_withhold', {
	vat: decimal('vat', { precision: 10, scale: 2 }).notNull(),
	withHold: decimal('with_hold', { precision: 10, scale: 2 }).notNull()
});

export const transactions = mysqlTable('transactions', {
	id: int('id').primaryKey().autoincrement(),
	description: varchar('description', { length: 255 }),
	amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
	paymentStatus: mysqlEnum('payment_status', [
		'pending',
		'paid',
		'unpaid',
		'refunded',
		'partially_paid',
		'partially_refunded',
		'overpaid',
		'disputed'
	]).default('pending'),
	paymentMethodId: int('payment_method_id').references(() => paymentMethods.id, {
		onDelete: 'set null'
	}),
	recieptLink: varchar('reciept_link', { length: 255 }),
	...secureFields
});

export const transactionsRelations = relations(transactions, ({ one }) => ({
	paymentMethod: one(paymentMethods, {
		fields: [transactions.paymentMethodId],
		references: [paymentMethods.id]
	})
}));

export const transactionServices = mysqlTable('transaction_services', {
	id: int('id').primaryKey().autoincrement(),
	staffId: int('staff_id')
		.references(() => employee.id)
		.notNull(),
	transactionId: int('transaction_id')
		.notNull()
		.references(() => transactions.id, { onDelete: 'cascade' }),
	serviceId: int('service_id')
		.notNull()
		.references(() => services.id),
	price: decimal('price', { precision: 10, scale: 2 }).notNull(),
	tip: decimal('tip', { precision: 10, scale: 2 }).notNull().default('0'),
	discount: int('discount').references(() => discounts.id),
	tax: decimal('tax', { precision: 10, scale: 2 }),
	total: decimal('total', { precision: 10, scale: 2 }),
	...secureFields
});

export const discounts = mysqlTable('discounts', {
	id: int('id').primaryKey().autoincrement(),
	amount: decimal('amount', { precision: 10, scale: 2 }),
	name: varchar('name', { length: 50 }).notNull().unique(),
	description: varchar('description', { length: 255 }),
	...secureFields
});

export const transactionSupplies = mysqlTable('transaction_supplies', {
	id: int('id').primaryKey().autoincrement(),
	transactionId: int('transaction_id')
		.notNull()
		.references(() => transactions.id, { onDelete: 'cascade' }),
	supplyId: int('supply_id').references(() => supplies.id, { onDelete: 'set null' }),
	quantity: decimal('quantity', { precision: 10, scale: 2 }).notNull().default('1'),
	unitPrice: decimal('unit_price', { precision: 10, scale: 2 }).notNull(),
	...secureFields
});

export const expenses = mysqlTable('expenses', {
	id: int('id').autoincrement().primaryKey(),
	expenseDate: date('expense_date').notNull(),
	type: int('type')
		.notNull()
		.references(() => expensesType.id),
	description: varchar('description', { length: 255 }),
	total: decimal('total', { precision: 10, scale: 2 }).notNull(),
	transactionId: int('transaction_id')
		.notNull()
		.references(() => transactions.id, { onDelete: 'cascade' }),
	...secureFields,
	...approvalFields
});

export const expensesType = mysqlTable('expenses_type', {
	id: int('id').autoincrement().primaryKey(),
	name: varchar('name', { length: 255 }).notNull().unique(),
	description: varchar('description', { length: 255 }),
	...secureFields
});

export const payrollRuns = mysqlTable(
	'payroll_runs',
	{
		id: int('id').autoincrement().primaryKey(),
		month: varchar('month', { length: 50 }).notNull(),
		year: year('year').notNull(),
		totalSalaries: decimal('total_salaries', { precision: 10, scale: 2 }),
		totalOvertime: decimal('total_overtime', { precision: 10, scale: 2 }),
		totalTransport: decimal('total_transport', { precision: 10, scale: 2 }),
		totalHousing: decimal('total_housing', { precision: 10, scale: 2 }),
		totalPosition: decimal('total_position', { precision: 10, scale: 2 }),
		totalNet: decimal('total_net', { precision: 10, scale: 2 }),
		totalDeductions: decimal('total_deductions', { precision: 10, scale: 2 }),
		totalPenalities: decimal('total_penalities', { precision: 10, scale: 2 }),
		totalTax: decimal('total_tax', { precision: 10, scale: 2 }),
		totalGross: decimal('total_gross', { precision: 10, scale: 2 }),
		penEm: decimal('pen_em', { precision: 10, scale: 2 }),
		penOrg: decimal('pen_org', { precision: 10, scale: 2 }),
		finalized: boolean('finalized').default(false).notNull(),
		finalizedBy: int('finalized_by').references(() => employee.id, { onDelete: 'set null' }),
		finalizedByUserId: varchar('finalized_by_user_id', { length: 255 }).references(() => user.id, {
			onDelete: 'set null'
		}),
		finalizedAt: datetime('finalized_at'),

		...secureFields,
		...approvalFields
	},
	(t) => [unique().on(t.month, t.year)]
);

export const payrollReceipts = mysqlTable('payroll_receipts', {
	id: int('id').autoincrement().primaryKey(),
	payrollRunId: int('payroll_run_id').references(() => payrollRuns.id),
	payPeriodStart: date('pay_period_start').notNull(),
	payPeriodEnd: date('pay_period_end').notNull(),
	amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
	paidDate: date('paid_date').notNull(),
	numberOfEmployees: int('number_of_employees').notNull(),
	recieptLink: varchar('reciept_link', { length: 255 }),
	transactionId: int('transaction_id').references(() => transactions.id, { onDelete: 'set null' }),
	...secureFields
});

export const payrollEntries = mysqlTable(
	'payroll_entries',
	{
		id: int('id').autoincrement().primaryKey(),
		payrollId: int('payroll_id').references(() => payrollRuns.id),
		staffId: int('staff_id')
			.notNull()
			.references(() => employee.id),
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
		payPeriodStart: date('pay_period_start').notNull(),
		payPeriodEnd: date('pay_period_end').notNull(),
		basicSalary: decimal('basic_salary', { precision: 10, scale: 2 }),
		overtimeAmount: decimal('overtime_amount', { precision: 10, scale: 2 }),
		deductions: decimal('deduction', { precision: 10, scale: 2 }),
		commissionAmount: decimal('commission_amount', { precision: 10, scale: 2 }),
		bonusAmount: decimal('bonus_amount', { precision: 10, scale: 2 }),
		allowances: decimal('allowances', { precision: 10, scale: 2 }),
		transportAllowance: decimal('transport_allowance', { precision: 10, scale: 2 }),
		positionAllowance: decimal('position_allowance', { precision: 10, scale: 2 }),
		housingAllowance: decimal('housing_allowance', { precision: 10, scale: 2 }),
		nonTaxableAllowance: decimal('non_taxable_allowance', { precision: 10, scale: 2 }),
		grossAmount: decimal('gross_amount', { precision: 10, scale: 2 }),
		netAmount: decimal('net_amount', { precision: 10, scale: 2 }),
		paidAmount: decimal('paid_amount', { precision: 10, scale: 2 }),
		attendancePenality: decimal('attendance_penality', { precision: 10, scale: 2 }),
		taxAmount: decimal('tax_amount', { precision: 10, scale: 2 }),
		status: mysqlEnum('status', ['pending', 'approved', 'paid']).default('pending').notNull(),
		paymentMethodId: int('payment_method_id').references(() => paymentMethods.id),
		paymentDate: date('payment_date'),
		penEm: decimal('pen_em', { precision: 10, scale: 2 }),
		penOrg: decimal('pen_org', { precision: 10, scale: 2 }),
		notes: varchar('notes', { length: 255 }),
		recieptLink: varchar('reciept_link', { length: 255 }),

		...secureFields
	},
	(table) => [
		index('staff_id_idx').on(table.staffId),
		index('payroll_id_idx').on(table.payrollId),
		index('period_idx').on(table.year, table.month),
		index('payment_method_idx').on(table.paymentMethodId)
	]
);

export const payrollAdjustments = mysqlTable('payroll_adjustments', {
	id: int('id').autoincrement().primaryKey(),
	payrollEntryId: int('payroll_entry_id').references(() => payrollEntries.id),
	adjustmentType: mysqlEnum('adjustment_type', ['bonus', 'deduction']).notNull(),
	basicSalary: decimal('basic_salary', { precision: 10, scale: 2 }),
	overtimeAmount: decimal('overtime_amount', { precision: 10, scale: 2 }),
	deductions: decimal('deduction', { precision: 10, scale: 2 }),
	commissionAmount: decimal('commission_amount', { precision: 10, scale: 2 }),
	bonusAmount: decimal('bonus_amount', { precision: 10, scale: 2 }),
	allowances: decimal('allowances', { precision: 10, scale: 2 }),
	transportAllowance: decimal('transport_allowance', { precision: 10, scale: 2 }),
	positionAllowance: decimal('position_allowance', { precision: 10, scale: 2 }),
	housingAllowance: decimal('housing_allowance', { precision: 10, scale: 2 }),
	nonTaxableAllowance: decimal('non_taxable_allowance', { precision: 10, scale: 2 }),
	grossAmount: decimal('gross_amount', { precision: 10, scale: 2 }),
	netAmount: decimal('net_amount', { precision: 10, scale: 2 }),
	amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
	reason: varchar('reason', { length: 255 }),
	transactionId: int('transaction_id').references(() => transactions.id),
	...secureFields,
	...approvalFields
});

export const transactionRelations = relations(transactions, ({ many }) => ({
	transactionServices: many(transactionServices), // this will be connected via saleId
	transactionSupplies: many(transactionSupplies) // this will be connected via saleId
}));

export const transactionServicessRelations = relations(transactionServices, ({ one }) => ({
	sale: one(transactions, {
		fields: [transactionServices.transactionId],
		references: [transactions.id]
	}),
	service: one(services, {
		fields: [transactionServices.serviceId],
		references: [services.id]
	})
}));
