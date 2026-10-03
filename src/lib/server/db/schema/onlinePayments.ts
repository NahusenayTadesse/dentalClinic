// onlinePayments.ts - Taking money through an online gateway: the clinic's accounts at each, and
// every payment asked for through one.
import {
	mysqlTable,
	mysqlEnum,
	varchar,
	int,
	text,
	decimal,
	boolean,
	datetime,
	json,
	index
} from 'drizzle-orm/mysql-core';
import { secureFields } from './secureFields';
import { branchRef } from './branches';
import { patient } from './patients';
import { paymentMethods, transactions } from './finance';

// Relative, not `$lib/…`: drizzle-kit loads the schema without SvelteKit's aliases.
import { GATEWAY_MODES, ONLINE_PAYMENT_STATUSES, PAYMENT_GATEWAYS } from '../../../paymentGateways';

/**
 * An account at a payment gateway — Chapa, Telebirr, ArifPay, SantimPay. Any number can be switched
 * on at once; the desk picks one for each payment.
 *
 * **The credentials are two columns, not one per field.** Each gateway asks for different things
 * (`$lib/paymentGateways.ts`). What must stay secret — a secret key, a private key — is one JSON
 * object, encrypted (`server/secrets.ts`) and never sent to a browser; `secretHint` is the last
 * four characters of the main one, so the screen can say which key is in use. What is not secret —
 * a merchant id, a short code — sits readable in `settings`.
 */
export const paymentGateway = mysqlTable('payment_gateway', {
	id: int('id').primaryKey().autoincrement(),
	provider: mysqlEnum('provider', PAYMENT_GATEWAYS).notNull(),
	label: varchar('label', { length: 80 }).notNull(),
	/** Test keys go to the gateway's sandbox and move no money. */
	mode: mysqlEnum('mode', GATEWAY_MODES).notNull().default('test'),
	secretsEncrypted: text('secrets_encrypted').notNull(),
	secretHint: varchar('secret_hint', { length: 8 }).notNull(),
	settings: json('settings').$type<Record<string, string>>().notNull(),
	/**
	 * What its money is recorded as on a receipt and in the day's takings. Set when the account is
	 * added, to the gateway's own method (created then if missing), so the reports can tell Chapa
	 * money from cash without anyone setting it up.
	 */
	paymentMethodId: int('payment_method_id')
		.notNull()
		.references(() => paymentMethods.id),
	/** Offered at the desk. Switched off keeps the account and its history, but takes nothing. */
	enabled: boolean('enabled').notNull().default(true),
	...secureFields
});

/**
 * One payment asked for through a gateway: which bills it is for, what the patient was sent to,
 * and what came of it.
 *
 * **Asked for is not paid.** Nothing touches a bill until the gateway itself says the money
 * arrived — asked when the desk presses Check, when the gateway's notification comes in, or by the
 * scheduled check — and then it is recorded as an ordinary payment (`transactionId`), with a receipt
 * number, through `server/payments.ts`. A notification is only ever a reason to ask; it is never
 * believed on its own word.
 *
 * `reference` is ours, sent to the gateway and unique, which is what makes a notification that
 * arrives twice record one payment: the payment's `gateway_txn_token` is this reference.
 */
export const onlinePayment = mysqlTable(
	'online_payment',
	{
		id: int('id').primaryKey().autoincrement(),
		gatewayId: int('gateway_id')
			.notNull()
			.references(() => paymentGateway.id),
		/** As text, so the list reads right after the account is removed. */
		provider: mysqlEnum('provider', PAYMENT_GATEWAYS).notNull(),
		reference: varchar('reference', { length: 40 }).notNull().unique(),
		patientId: int('patient_id')
			.notNull()
			.references(() => patient.id),
		amount: decimal('amount', { precision: 12, scale: 2, mode: 'number' }).notNull(),
		/** How much goes to which bill — the same split a payment at the desk posts. */
		allocations: json('allocations').$type<{ invoiceId: number; amount: number }[]>().notNull(),
		phone: varchar('phone', { length: 20 }),
		status: mysqlEnum('status', ONLINE_PAYMENT_STATUSES).notNull().default('pending'),
		/** Where the patient pays. Null until the gateway gave one, and if it refused. */
		checkoutUrl: varchar('checkout_url', { length: 1024 }),
		/** The gateway's id for the checkout, where it looks payments up by its own id. */
		sessionId: varchar('session_id', { length: 128 }),
		/** The gateway's id for the money once paid. */
		providerReference: varchar('provider_reference', { length: 128 }),
		/** The gateway's own word for the state, as received. */
		providerStatus: varchar('provider_status', { length: 50 }),
		transactionId: int('transaction_id').references(() => transactions.id),
		/** Why it failed, from the gateway or the network. Never holds a key. */
		error: varchar('error', { length: 255 }),
		checkedAt: datetime('checked_at'),
		paidAt: datetime('paid_at'),
		branchId: branchRef(),
		...secureFields
	},
	(table) => [
		index('online_payment_patient_idx').on(table.patientId),
		index('online_payment_status_idx').on(table.status)
	]
);
