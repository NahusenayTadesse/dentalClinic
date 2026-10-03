// settings.ts - The handful of choices a clinic makes about how it runs, and document numbering.
import { mysqlTable, int, decimal, varchar, timestamp, boolean } from 'drizzle-orm/mysql-core';
// Relative, not `$lib/…`: drizzle-kit loads the schema without SvelteKit's aliases.
import { DEFAULT_SMS_TEMPLATES } from '../../../smsTemplates';
import { sql } from 'drizzle-orm';
import { user } from './user';

/**
 * The clinic's own settings — one row, `id` 1, read by `server/settings.ts`.
 *
 * Typed columns rather than a key/value table: every setting here is read by code that needs its
 * type, and a string column holding "10" for one key and "true" for another is a parse, and a
 * mistake, at every read. A new setting is a column with a default, so an existing clinic gets a
 * sensible value without doing anything.
 *
 * Non-goal: per-branch settings. A clinic's billing policy is the clinic's; a branch that genuinely
 * needs its own is the day this grows a `branchId`.
 */
export const clinicSettings = mysqlTable('clinic_settings', {
	id: int('id').primaryKey(),

	/**
	 * A discount above this share of a bill goes to a manager for approval before the bill can be
	 * paid (`invoice.approvalStatus`). A percentage: 10 means a discount over 10% needs approval.
	 * 0 sends every discount; 100 sends none. A discount is where money leaves a cash practice
	 * without anyone noticing, which is why there is a threshold at all.
	 */
	discountApprovalPercent: decimal('discount_approval_percent', {
		precision: 5,
		scale: 2,
		mode: 'number'
	})
		.notNull()
		.default(10),

	// ── Tax, as the clinic's accountant has set it up ───────────────────────────────────────────

	/** The clinic's Taxpayer Identification Number, printed on every bill and receipt. */
	tin: varchar('tin', { length: 20 }),

	/**
	 * Whether the clinic is registered for VAT. Off by default, because most small clinics are not
	 * — they pay turnover tax on their own return, which puts nothing extra on the patient's bill.
	 * Registered, a bill charges VAT on its taxable lines at `vatRate` (`$lib/billTax.ts`).
	 */
	vatRegistered: boolean('vat_registered').notNull().default(false),
	vatRate: decimal('vat_rate', { precision: 5, scale: 2, mode: 'number' }).notNull().default(15),

	/**
	 * Whether charted treatment carries VAT. Off: medical services are, as this app understands
	 * Ethiopian VAT law, exempt, while goods the clinic sells (a toothbrush, a whitening kit) are
	 * not. A setting rather than a rule in code because it is the clinic's accountant's call, not
	 * the software's — and the day the law or their reading of it changes, it is one switch.
	 */
	vatOnServices: boolean('vat_on_services').notNull().default(false),

	/**
	 * The text of an appointment reminder and of a recall, with `{name}`, `{date}`, `{time}`,
	 * `{clinic}`, `{phone}` and `{visit}` filled in when sent (`$lib/smsTemplates.ts`). Amharic by
	 * default, because that is what patients read; the clinic edits them on the SMS screen.
	 */
	smsReminderTemplate: varchar('sms_reminder_template', { length: 320 })
		.notNull()
		.default(DEFAULT_SMS_TEMPLATES.reminder),
	smsRecallTemplate: varchar('sms_recall_template', { length: 320 })
		.notNull()
		.default(DEFAULT_SMS_TEMPLATES.recall),

	/**
	 * How many years after a patient was last seen their record is kept before it is reviewed for
	 * deletion or anonymising (Personal Data Protection Proclamation 1321/2024: kept no longer than
	 * needed). Ten years is common practice for health records here; a child's record is usually
	 * kept until they are adults and then some, which the review list leaves to a person.
	 */
	recordRetentionYears: int('record_retention_years').notNull().default(10),

	updatedBy: varchar('updated_by', { length: 255 }).references(() => user.id, {
		onDelete: 'set null'
	}),
	updatedAt: timestamp('updated_at')
		.default(sql`CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3)`)
		.notNull()
});

/**
 * The next number of each numbered document — invoices and receipts, per Ethiopian year.
 *
 * **Why a counter and not `MAX(number) + 1`.** Two receptionists issuing at once both read the same
 * maximum and write the same number; a unique index then fails one of them after the patient has
 * been told a total. Here the row is locked and incremented inside the issuing transaction
 * (`nextNumber` in `server/billing.ts`), so the second waits for the first and gets the next
 * number. A number is taken only when a document is issued, so a draft never burns one.
 *
 * Non-goal: gap-free numbering across a rolled-back issue. A failed issue after the increment rolls
 * the increment back with it, so gaps come only from a crash between the two, which the database
 * rules out by running both in one transaction.
 */
export const documentSequence = mysqlTable('document_sequence', {
	/** Which series: `invoice-2019`, `receipt-2019`. */
	name: varchar('name', { length: 40 }).primaryKey(),
	/** The number the next document in the series will get. */
	nextValue: int('next_value').notNull().default(1)
});
