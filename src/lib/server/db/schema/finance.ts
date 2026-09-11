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
	datetime,
	text,
	type AnyMySqlColumn
} from 'drizzle-orm/mysql-core';
import { employee } from './staff';
import { secureFields, approvalFields } from './secureFields';
import { services } from './services';
import { supplies } from '../schema';
import { user } from './user';
import { branchRef } from './branches';
import { patient } from './patients';
import { customers } from './customers';

export const paymentMethods = mysqlTable('payment_methods', {
	id: int('id').primaryKey().autoincrement(),
	name: varchar('name', { length: 100 }).notNull().unique(),
	description: varchar('description', { length: 255 }),
	...secureFields
});

export const vatAndWithHold = mysqlTable('vat_and_withhold', {
	vat: decimal('vat', { precision: 10, scale: 2 }).notNull(),
	withHold: decimal('with_hold', { precision: 10, scale: 2 }).notNull()
});

/**
 * One movement of money, in either direction. The hub of the accounting system: expenses,
 * payroll receipts, payroll adjustments, and the service and supply lines of a sale all hang off
 * this row rather than carrying money of their own.
 *
 * Everything added below is nullable, so a cash payment taken at the desk is still four fields.
 */
export const transactions = mysqlTable('transactions', {
	id: int('id').primaryKey().autoincrement(),
	description: varchar('description', { length: 255 }),

	/**
	 * Which way the money went, as a physical fact rather than an accounting category.
	 *
	 * The row could not say this before, and it had to be inferred from whichever table happened
	 * to reference it — `expenses` meant out, `transaction_services` meant in — so no query could
	 * total a day's takings without joining everything that might point at a transaction.
	 *
	 * Deliberately not a category like "revenue" or "operating expense": a refund and a salary
	 * are both `out` and mean entirely different things, and *what* a movement was for is already
	 * recorded by whatever references it. Two values that are never wrong beat five that need
	 * interpreting.
	 */
	direction: mysqlEnum('direction', ['in', 'out']).notNull().default('in'),

	/**
	 * `mode: 'number'` per CLAUDE.md §9. It was missing, which meant Drizzle handed back a string
	 * and any arithmetic on it silently concatenated — `'500' + '200'` is `'500200'`. Every
	 * existing use is a SQL-level comparison or `SUM()`, so nothing was relying on the strings,
	 * but the new columns below are added and totalled together and one of them being a string
	 * would have been a very quiet bug in the one table where money is counted.
	 */
	amount: decimal('amount', { precision: 10, scale: 2, mode: 'number' }).notNull(),
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

	// ── Who ──────────────────────────────────────────────────────────────────────────────────────

	/**
	 * The patient this money is from or to. Null for anything that is not about a patient — a
	 * salary, the electricity bill, a supplier invoice.
	 *
	 * `set null`, not cascade: deleting a patient must never delete the record that they paid.
	 * The money happened whether or not the patient record survives, and an accounting system
	 * that loses rows when a person is removed cannot be reconciled.
	 */
	patientId: int('patient_id').references(() => patient.id, { onDelete: 'set null' }),

	/**
	 * The corporate account that settled it, where an employer or insurer did. Null for the usual
	 * case of a patient paying at the desk. Both this and `patientId` can be set at once: the
	 * patient was treated, the company paid.
	 */
	customerId: int('customer_id').references(() => customers.id, { onDelete: 'set null' }),

	// ── When ─────────────────────────────────────────────────────────────────────────────────────

	/**
	 * The date the money actually moved, which is not `createdAt`.
	 *
	 * A payment taken on Friday and entered on Monday belongs to Friday, and a month closes on
	 * the movements that happened inside it rather than on when somebody typed them. Without this
	 * every report is really a report on data entry.
	 */
	occurredOn: date('occurred_on'),

	// ── Tax, as an Ethiopian receipt has to show it ──────────────────────────────────────────────

	/**
	 * The figures a VAT receipt must break out separately: net, VAT, and withholding deducted at
	 * source. Rates live in `vat_and_withhold`; these are the amounts as computed at the time, so
	 * a later rate change cannot rewrite what an issued receipt said.
	 *
	 * All nullable, because a clinic below the registration threshold issues no VAT at all and
	 * should not have to record zeroes to say so. `amount` stays the total actually moved.
	 */
	subtotal: decimal('subtotal', { precision: 10, scale: 2, mode: 'number' }),
	vatAmount: decimal('vat_amount', { precision: 10, scale: 2, mode: 'number' }),
	withholdingAmount: decimal('withholding_amount', { precision: 10, scale: 2, mode: 'number' }),

	// ── Receipt and fiscal clearance ─────────────────────────────────────────────────────────────

	/** The clinic's own receipt number — what is written on the paper handed over. */
	receiptNumber: varchar('receipt_number', { length: 50 }),

	/**
	 * Clearance with the Ministry of Revenues' electronic invoicing system.
	 *
	 * Directive 1142/2018 EC requires taxpayers who keep books of accounts to issue invoices
	 * through an approved system connected to the Ministry, and an invoice is not valid until
	 * that system has issued identifiers for it — a clearance model rather than after-the-fact
	 * reporting.
	 *
	 * **These columns are deliberately generic.** The directive delegates the field
	 * specification, the QR format and the rollout schedule to separate Authority guidance that
	 * is not published, so inventing `invoice_registration_number` and
	 * `receipt_registration_number` columns now would mean guessing at names and shapes and
	 * migrating them again when the real spec lands. `fiscalReference` holds whatever single
	 * identifier comes back, `fiscalQr` holds the QR payload verbatim, and `fiscalStatus` is what
	 * the app actually branches on. A clinic below the threshold sits at `notRequired` forever.
	 */
	fiscalStatus: mysqlEnum('fiscal_status', ['notRequired', 'pending', 'cleared', 'failed'])
		.notNull()
		.default('notRequired'),
	fiscalReference: varchar('fiscal_reference', { length: 128 }),
	fiscalQr: text('fiscal_qr'),
	fiscalClearedAt: datetime('fiscal_cleared_at'),

	// ── Payment gateway ──────────────────────────────────────────────────────────────────────────

	/**
	 * Which provider processed it — telebirr, cbebirr, chapa, arifpay. A plain string rather than
	 * an enum or a lookup: the set changes faster than a migration can, and `payment_methods`
	 * already models what the patient chose. This records which integration to ask about it.
	 */
	gateway: varchar('gateway', { length: 50 }),

	/**
	 * The gateway's own reference for this payment, and **unique**, which is the point of it.
	 *
	 * Gateways retry callbacks. A network timeout on our side means the same notification arrives
	 * twice, and without a uniqueness guarantee in the database the second one becomes a second
	 * transaction and the day's takings are overstated. An application check cannot close that
	 * race; a unique index can. Nullable, so every cash payment ever taken leaves it empty and
	 * NULLs do not collide.
	 */
	gatewayTxnToken: varchar('gateway_txn_token', { length: 128 }).unique(),

	/** A second provider-side id where there is one — an order reference against a payment id. */
	gatewayReference: varchar('gateway_reference', { length: 128 }),

	/** The provider's own status string, stored as received rather than mapped. */
	gatewayStatus: varchar('gateway_status', { length: 50 }),

	// ── Corrections ──────────────────────────────────────────────────────────────────────────────

	/**
	 * The transaction this one reverses.
	 *
	 * Money is corrected by a second, opposite movement, never by editing or deleting the first.
	 * A receipt has already been handed over and possibly cleared with the Ministry; changing the
	 * row it came from would make the paper and the system disagree, which is the one thing an
	 * accounting system exists to prevent. Soft delete is not a substitute — it hides the row
	 * rather than recording that it was undone, and by whom.
	 */
	reversesTransactionId: int('reverses_transaction_id').references(
		(): AnyMySqlColumn => transactions.id,
		{ onDelete: 'set null' }
	),

	/** Where the money was taken. See `branchRef`. */
	branchId: branchRef(),
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
	tax: decimal('tax', { precision: 10, scale: 2 }),
	total: decimal('total', { precision: 10, scale: 2 }),
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
		/** Which location this run covers. See `branchRef`. */
		branchId: branchRef(),

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
