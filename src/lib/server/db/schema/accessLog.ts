// accessLog.ts - Who looked at a patient's record.
import { mysqlTable, mysqlEnum, varchar, int, timestamp, index } from 'drizzle-orm/mysql-core';
import { relations } from 'drizzle-orm';
import { patient } from './patients';
import { user } from './user';

/**
 * One read of one patient's clinical record.
 *
 * `audit_log` records what *changed*. This records what was *seen*, which for patient data is the
 * question that actually gets asked: not "who altered this file" but "who has been looking at it".
 * The two most common reasons a clinic needs that answer are a member of staff reading the notes
 * of someone they are not treating, and a patient asking who has had access to theirs.
 *
 * **Patient clinical records only, deliberately.** Nothing else writes here — not appointments,
 * not invoices, not stock, not staff records. Logging every read of everything would bury the
 * signal in scheduling traffic and turn a targeted control into noise, and none of those carry
 * the information that makes a leak matter. `recordType` is the closed list of what counts.
 *
 * **No `secureFields`, and that is the point.** No soft delete, no `updatedBy`, nothing that can
 * amend a row after it is written. An audit record that can be quietly removed is not an audit
 * record, and this is the one table in the schema where the ability to delete would defeat the
 * reason for keeping it. Rows are inserted and then only ever read.
 *
 * Volume is expected and accepted. A busy clinic seeing fifty patients a day, with each record
 * opened a handful of times, writes on the order of a hundred thousand rows a year — trivial for
 * MySQL to hold and index, and storage is the resource that can be bought. Pruning, if it is ever
 * wanted, is a date range on `viewedAt` and touches nothing else, which is the other reason this
 * is its own table rather than rows mixed into `audit_log`.
 */
export const patientAccessLog = mysqlTable(
	'patient_access_log',
	{
		id: int('id').primaryKey().autoincrement(),

		/**
		 * Whose record was opened. `cascade`: if a patient is genuinely erased, the record of who
		 * read them goes too — keeping access rows for a person the system no longer holds would
		 * leave a trail about someone with no file to protect.
		 */
		patientId: int('patient_id')
			.notNull()
			.references(() => patient.id, { onDelete: 'cascade' }),

		/**
		 * Who looked. `set null` rather than cascade — the opposite choice to the patient side,
		 * and deliberately: deleting a user account must not erase the evidence of what that
		 * account did. The row survives with a null actor, which is still a fact.
		 */
		userId: varchar('user_id', { length: 255 }).references(() => user.id, {
			onDelete: 'set null'
		}),

		/**
		 * What kind of record was opened. A closed list, because it is the definition of "sensitive
		 * patient information" for this table — adding to it is a decision, not a convenience.
		 *
		 * `summary` is the patient screen itself; the rest are the clinical children that carry
		 * the detail somebody would actually want to see.
		 */
		recordType: mysqlEnum('record_type', [
			'summary',
			'allergies',
			'conditions',
			'medications',
			'note',
			'prescription',
			'file',
			'procedure',
			'treatmentPlan',
			'invoice',
			'consent',
			'labCase',
			'perio',
			'ortho',
			// The whole record, handed to the patient (`server/patientRecord.ts`).
			'fullRecord'
		]).notNull(),

		/** Which row, where one was opened. Null for the patient summary, which is the patient. */
		recordId: int('record_id'),

		/**
		 * `view`   — opened on screen
		 * `print`  — put on paper, which leaves the building
		 * `export` — downloaded or sent, which leaves the building and is copyable
		 *
		 * Separated because they are not equally serious. A hundred views is a clinician working;
		 * a hundred exports is a problem, and a query that cannot tell them apart cannot say so.
		 */
		action: mysqlEnum('action', ['view', 'print', 'export']).notNull().default('view'),

		ipAddress: varchar('ip_address', { length: 45 }),

		/** Where it was read from. Plain int, not `branchRef()` — see the note on `audit_log`. */
		branchId: int('branch_id'),

		viewedAt: timestamp('viewed_at').defaultNow().notNull()
	},
	(table) => [
		// "Who has opened this patient's file" — the question a patient asks.
		index('patient_access_patient_idx').on(table.patientId, table.viewedAt),
		// "What has this account been reading" — the question that catches snooping.
		index('patient_access_user_idx').on(table.userId, table.viewedAt),
		// Pruning, and the export report.
		index('patient_access_action_idx').on(table.action, table.viewedAt)
	]
);

export const patientAccessLogRelations = relations(patientAccessLog, ({ one }) => ({
	patient: one(patient, { fields: [patientAccessLog.patientId], references: [patient.id] }),
	user: one(user, { fields: [patientAccessLog.userId], references: [user.id] })
}));
