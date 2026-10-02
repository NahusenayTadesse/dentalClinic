// Customers and how to reach them.
//
// The contract, monthly-payment and penalty tables that used to live here were the facilities
// business's client billing; they went with the prune.
import {
	mysqlTable,
	varchar,
	int,
	mysqlEnum,
	decimal,
	boolean,
	date,
	type AnyMySqlColumn
} from 'drizzle-orm/mysql-core';
import { secureFields, approvalFields } from './secureFields';
import { address } from './locations';
// Lazy (`(): AnyMySqlColumn => patient.id`): `patients.ts` imports this file for its payer.
import { patient } from './patients';

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

	// ── What the payer covers (`server/payerCover.ts`) ──────────────────────────────────────────

	/**
	 * The share of a bill the payer pays, as a percentage. 100 by default — an employer paying its
	 * staff's bills outright. An insurer paying 80% leaves 20% to the patient, billed to them as a
	 * co-payment when the payer's bill is issued.
	 */
	coveragePercent: decimal('coverage_percent', { precision: 5, scale: 2, mode: 'number' })
		.notNull()
		.default(100),
	/**
	 * The most the payer pays for one member in an Ethiopian year, in birr; null for no limit. A bill
	 * that runs past it is split, and the part over the limit is the patient's.
	 */
	annualLimit: decimal('annual_limit', { precision: 12, scale: 2, mode: 'number' }),
	/** The payer must approve treatment before it is billed to them (`payer_authorisation`). */
	requiresPreauth: boolean('requires_preauth').notNull().default(false),

	...secureFields,
	...approvalFields
});

/**
 * A payer's approval of treatment before it is billed to them — what an insurer calls a
 * pre-authorisation, with the reference they gave and how much they agreed to.
 *
 * A bill to a payer that requires one cannot be issued without an approved authorisation, still in
 * date, with enough of its amount left; issuing takes from it (`invoice.authorisationId`). Kept on
 * the patient's Billing tab, audited, because it is a promise of money.
 */
export const payerAuthorisation = mysqlTable('payer_authorisation', {
	id: int('id').primaryKey().autoincrement(),
	patientId: int('patient_id')
		.notNull()
		.references((): AnyMySqlColumn => patient.id, { onDelete: 'cascade' }),
	customerId: int('customer_id')
		.notNull()
		.references(() => customers.id),
	/** The payer's own reference, quoted back on the bill and the claim. */
	reference: varchar('reference', { length: 100 }),
	/** What the clinic asked for. */
	requestedAmount: decimal('requested_amount', { precision: 12, scale: 2, mode: 'number' }),
	/** What the payer agreed to; null until they answer. */
	approvedAmount: decimal('approved_amount', { precision: 12, scale: 2, mode: 'number' }),
	status: mysqlEnum('status', ['requested', 'approved', 'declined']).notNull().default('requested'),
	/** The last day it can be billed against, as a clinic day; null for no end. */
	validUntil: date('valid_until', { mode: 'string' }),
	note: varchar('note', { length: 255 }),
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
