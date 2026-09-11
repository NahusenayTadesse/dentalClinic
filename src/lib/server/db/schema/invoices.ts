// invoices.ts - What a patient owes, and what has been paid against it.
import {
	mysqlTable,
	mysqlEnum,
	varchar,
	int,
	smallint,
	decimal,
	date,
	datetime,
	text,
	unique,
	index
} from 'drizzle-orm/mysql-core';
import { relations } from 'drizzle-orm';
import { secureFields } from './secureFields';
import { branchRef } from './branches';
import { patient } from './patients';
import { customers } from './customers';
import { provider } from './providers';
import { tooth } from './teeth';
import { procedures } from './procedures';
import { appointment } from './scheduling';
import { transactions } from './finance';

/**
 * A bill issued to a patient.
 *
 * **An invoice is not a transaction.** A transaction is money moving; an invoice is money owed.
 * They are deliberately separate tables joined through `invoice_payment`, because the
 * relationship is many-to-many in both directions and in this market routinely is: a crown paid
 * off over three months is one invoice and three payments, and a patient settling two visits at
 * once is one payment against two invoices. A `transactionId` column on the invoice could express
 * neither, and "what does this patient still owe" is the question a clinic asks most.
 *
 * `patientId` is `restrict`, alone among the patient's child tables — allergies, contacts,
 * procedures and appointments all cascade. That asymmetry is the point: clinical records follow
 * the patient, but you may not erase someone you have billed. Hard-deleting a patient is not a
 * supported operation anyway; every delete in this app is soft.
 *
 * Non-goal: a running `amountPaid` column. It would be a second copy of
 * `SUM(invoice_payment.amount)` and free to disagree with it, which on a balance is the worst
 * place for a discrepancy to hide. The sum is a join over an indexed foreign key.
 */
export const invoice = mysqlTable(
	'invoice',
	{
		id: int('id').primaryKey().autoincrement(),

		patientId: int('patient_id')
			.notNull()
			.references(() => patient.id),

		/** The employer or insurer being billed instead, where one is. */
		customerId: int('customer_id').references(() => customers.id, { onDelete: 'set null' }),

		branchId: branchRef(),

		/** The clinician the work is attributed to. Null for a bill covering several. */
		providerId: int('provider_id').references(() => provider.id, { onDelete: 'set null' }),

		/**
		 * The visit this bill was raised from.
		 *
		 * An invoice is generated from an appointment by gathering that appointment's procedures
		 * and writing each one out as a snapshotted line — which is why the link is here and not on
		 * `invoice_line`. Going through the visit rather than straight to the procedures means the
		 * bill has an obvious origin a receptionist can point at, and "has this visit been billed"
		 * is a single lookup rather than a search through lines.
		 *
		 * Nullable and `set null`, because not every bill comes from one visit: a course of
		 * treatment billed together spans several, and a standalone charge — a missed-appointment
		 * fee, a replacement retainer — comes from none. Nothing renders through it, for the same
		 * reason nothing renders through `procedureId`.
		 */
		appointmentId: int('appointment_id').references(() => appointment.id, {
			onDelete: 'set null'
		}),

		/** The clinic's own sequence. Unique: two invoices may not share a number. */
		invoiceNumber: varchar('invoice_number', { length: 50 }).unique(),

		issuedOn: date('issued_on').notNull(),
		/** When payment is expected. Null for pay-now, which is most of them. */
		dueOn: date('due_on'),

		/**
		 * `draft`   — being assembled, nothing handed over, still freely editable
		 * `issued`  — given to the patient. From here the lines are frozen (see `invoice_line`)
		 * `partly`  — some money received against it
		 * `paid`    — settled
		 * `void`    — cancelled. Never deleted, and never edited back to `draft`
		 */
		status: mysqlEnum('status', ['draft', 'issued', 'partly', 'paid', 'void'])
			.notNull()
			.default('draft'),

		/** Totals as issued. Rates live in `vat_and_withhold`; these are the amounts at the time. */
		subtotal: decimal('subtotal', { precision: 10, scale: 2, mode: 'number' }).notNull(),
		discount: decimal('discount', { precision: 10, scale: 2, mode: 'number' }),
		vatAmount: decimal('vat_amount', { precision: 10, scale: 2, mode: 'number' }),
		withholdingAmount: decimal('withholding_amount', { precision: 10, scale: 2, mode: 'number' }),
		total: decimal('total', { precision: 10, scale: 2, mode: 'number' }).notNull(),

		/**
		 * A voided invoice keeps its number and its lines. Reissuing under the same number is how
		 * two different documents come to exist claiming to be the same invoice — the paper one the
		 * patient is holding, and the one in the system.
		 */
		voidedAt: datetime('voided_at'),
		voidReason: varchar('void_reason', { length: 255 }),

		note: text('note'),

		...secureFields
	},
	(table) => [
		// "What does this patient owe" — the balance query, newest first.
		index('invoice_patient_status_idx').on(table.patientId, table.status),
		index('invoice_branch_issued_idx').on(table.branchId, table.issuedOn),
		index('invoice_customer_idx').on(table.customerId),
		// "Has this visit been billed yet?"
		index('invoice_appointment_idx').on(table.appointmentId)
	]
);

/**
 * One line of a bill.
 *
 * **The line carries its own description and price rather than reading them from the procedure.**
 * This is the decision the table exists to make: an issued invoice must say the same thing
 * tomorrow that it said when it was printed. If the line rendered from `procedures.fee`, then
 * correcting a fee or re-charting a treatment would silently rewrite a document the patient is
 * holding — they have a receipt for 6,500 and the system shows 7,000, and neither of you can
 * prove which was issued. Same reasoning as reversing a transaction instead of editing it.
 *
 * `procedureId` stays for traceability — which treatment this billed — but nothing is read
 * through it at render time, and `set null` means re-charting cannot orphan a document.
 *
 * Supersedes `transaction_services`, which is the same idea attached directly to a payment: it
 * came from the facilities business, where you paid at the desk and listed what for. That table
 * still has four report consumers and should go when the transaction flows are reworked; until
 * then, do not write to both.
 */
export const invoiceLine = mysqlTable(
	'invoice_line',
	{
		id: int('id').primaryKey().autoincrement(),

		invoiceId: int('invoice_id')
			.notNull()
			.references(() => invoice.id, { onDelete: 'cascade' }),

		/** Traceability only. Never read to render the line — see above. */
		procedureId: int('procedure_id').references(() => procedures.id, { onDelete: 'set null' }),

		/** Snapshot. What the patient sees, in the words used when it was issued. */
		description: varchar('description', { length: 255 }).notNull(),

		/** Which tooth, on a dental bill. Snapshot-adjacent but safe: a tooth cannot be re-priced. */
		toothId: smallint('tooth_id').references(() => tooth.id),

		quantity: decimal('quantity', { precision: 10, scale: 2, mode: 'number' }).notNull().default(1),
		/** Snapshot. */
		unitPrice: decimal('unit_price', { precision: 10, scale: 2, mode: 'number' }).notNull(),
		/** Snapshot, and stored rather than computed: quantity × price is what the paper says. */
		lineTotal: decimal('line_total', { precision: 10, scale: 2, mode: 'number' }).notNull(),

		sortOrder: int('sort_order').notNull().default(0),

		...secureFields
	},
	(table) => [
		index('invoice_line_invoice_idx').on(table.invoiceId),
		index('invoice_line_procedure_idx').on(table.procedureId)
	]
);

/**
 * Money allocated from one payment to one invoice.
 *
 * The join that makes installments work. A patient paying 2,000 against a 6,500 crown creates one
 * transaction and one allocation; the next two payments add two more rows, and the invoice's
 * balance is `total - SUM(amount)`. A single payment covering two visits creates one transaction
 * and two allocations.
 *
 * `transactionId` is `restrict`: an allocation whose payment has been deleted would be money
 * claimed against an invoice that no longer exists anywhere, which is how a balance silently
 * heals itself. Payments are reversed through `transactions.reversesTransactionId`, not removed.
 *
 * Non-goal: allocating *more* than the transaction holds, or more than the invoice is for. Both
 * are sums across rows and neither is expressible as a constraint, so the write path owns them —
 * the same division as everywhere else.
 */
export const invoicePayment = mysqlTable(
	'invoice_payment',
	{
		id: int('id').primaryKey().autoincrement(),

		invoiceId: int('invoice_id')
			.notNull()
			.references(() => invoice.id, { onDelete: 'cascade' }),

		transactionId: int('transaction_id')
			.notNull()
			.references(() => transactions.id),

		/** How much of that payment goes to this invoice. Not the whole transaction. */
		amount: decimal('amount', { precision: 10, scale: 2, mode: 'number' }).notNull(),

		...secureFields
	},
	(table) => [
		index('invoice_payment_invoice_idx').on(table.invoiceId),
		index('invoice_payment_transaction_idx').on(table.transactionId),
		/*
		 * One row per payment per invoice. A second allocation of the same payment to the same
		 * invoice is a double entry, not a part payment — a part payment is a smaller `amount` on
		 * the single row. Without this a retried save silently doubles what an invoice looks paid.
		 */
		unique('invoice_payment_unique').on(table.invoiceId, table.transactionId)
	]
);

export const invoiceRelations = relations(invoice, ({ one, many }) => ({
	patient: one(patient, { fields: [invoice.patientId], references: [patient.id] }),
	customer: one(customers, { fields: [invoice.customerId], references: [customers.id] }),
	provider: one(provider, { fields: [invoice.providerId], references: [provider.id] }),
	appointment: one(appointment, {
		fields: [invoice.appointmentId],
		references: [appointment.id]
	}),
	lines: many(invoiceLine),
	payments: many(invoicePayment)
}));

export const invoiceLineRelations = relations(invoiceLine, ({ one }) => ({
	invoice: one(invoice, { fields: [invoiceLine.invoiceId], references: [invoice.id] }),
	procedure: one(procedures, { fields: [invoiceLine.procedureId], references: [procedures.id] }),
	tooth: one(tooth, { fields: [invoiceLine.toothId], references: [tooth.id] })
}));

export const invoicePaymentRelations = relations(invoicePayment, ({ one }) => ({
	invoice: one(invoice, { fields: [invoicePayment.invoiceId], references: [invoice.id] }),
	transaction: one(transactions, {
		fields: [invoicePayment.transactionId],
		references: [transactions.id]
	})
}));
