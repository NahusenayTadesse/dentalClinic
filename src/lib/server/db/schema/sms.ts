// sms.ts - Text messages to patients: who sends them, and every one that went out.
import {
	mysqlTable,
	mysqlEnum,
	varchar,
	int,
	text,
	decimal,
	smallint,
	boolean,
	index
} from 'drizzle-orm/mysql-core';
import { secureFields } from './secureFields';
import { branchRef } from './branches';
import { patient } from './patients';
import { appointment } from './scheduling';
import { recall } from './recalls';

// Relative, not `$lib/…`: drizzle-kit loads the schema without SvelteKit's aliases.
import { SMS_PROVIDERS } from '../../../smsTemplates';

/**
 * An account at an SMS gateway: which one, its API key, and what it sends as.
 *
 * **The key is encrypted, not hashed.** A password is hashed because it is only ever compared; an
 * API key has to be read back to be sent with each message, so it is encrypted with AES-256-GCM
 * (`server/secrets.ts`) under a key derived from the server's secret, and the plain key exists only
 * in the memory of the request that sends. `apiKeyHint` (its last four characters) is all the
 * screen ever shows, so someone can tell which key is in use without the key leaving the server.
 *
 * Several accounts can be kept — a second gateway as a fallback, a test account — but messages go
 * through the one marked `isDefault`; `server/sms/` keeps there being at most one.
 */
export const smsProvider = mysqlTable('sms_provider', {
	id: int('id').primaryKey().autoincrement(),
	provider: mysqlEnum('provider', SMS_PROVIDERS).notNull(),
	/** What the clinic calls this account — "AfroMessage, main line". */
	label: varchar('label', { length: 80 }).notNull(),
	/** `v1:<iv>:<tag>:<ciphertext>`, base64 — see `server/secrets.ts`. Never sent to a browser. */
	apiKeyEncrypted: text('api_key_encrypted').notNull(),
	/** The key's last four characters, for the screen. */
	apiKeyHint: varchar('api_key_hint', { length: 8 }).notNull(),
	/** The sender name the gateway approved for this clinic, shown as the message's "from". */
	senderName: varchar('sender_name', { length: 32 }),
	/** AfroMessage's identifier id, or GeezSMS's shortcode id; optional on both. */
	senderId: varchar('sender_id', { length: 64 }),
	/**
	 * What one message segment costs, in birr, for the cost log. The gateways' replies do not say,
	 * and a clinic knows its own rate. Null means "not known", which the log shows as blank rather
	 * than as free.
	 */
	costPerSegment: decimal('cost_per_segment', { precision: 8, scale: 2, mode: 'number' }),
	isDefault: boolean('is_default').notNull().default(false),
	...secureFields
});

/**
 * One text message, sent or failed. The log a clinic paying per message needs, and the only way to
 * answer "did we tell her?".
 *
 * The body is kept as sent, because the template it came from can change. The recipient's number
 * is kept too: the patient's phone can change, and the log must say where the message went.
 * Linked to the appointment or recall it was about, so the reminder list can say a text went out.
 */
export const smsMessage = mysqlTable(
	'sms_message',
	{
		id: int('id').primaryKey().autoincrement(),
		patientId: int('patient_id').references(() => patient.id, { onDelete: 'set null' }),
		appointmentId: int('appointment_id').references(() => appointment.id, {
			onDelete: 'set null'
		}),
		recallId: int('recall_id').references(() => recall.id, { onDelete: 'set null' }),
		kind: mysqlEnum('kind', ['reminder', 'recall', 'test']).notNull(),
		toPhone: varchar('to_phone', { length: 20 }).notNull(),
		body: text('body').notNull(),
		providerId: int('provider_id').references(() => smsProvider.id, { onDelete: 'set null' }),
		/** The gateway, as text, so the log reads right after the account is deleted. */
		provider: mysqlEnum('provider', SMS_PROVIDERS).notNull(),
		status: mysqlEnum('status', ['sent', 'failed']).notNull(),
		/** The gateway's id for the message, when it gives one. */
		providerMessageId: varchar('provider_message_id', { length: 100 }),
		/** Why it failed, as the gateway or the network said. Never holds the API key. */
		error: varchar('error', { length: 255 }),
		segments: smallint('segments').notNull(),
		/** `segments × costPerSegment` at the time of sending; null when the rate is not known. */
		cost: decimal('cost', { precision: 10, scale: 2, mode: 'number' }),
		branchId: branchRef(),
		...secureFields
	},
	(table) => [
		index('sms_message_appointment_idx').on(table.appointmentId),
		index('sms_message_recall_idx').on(table.recallId),
		index('sms_message_created_idx').on(table.createdAt)
	]
);
