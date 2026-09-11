// notes.ts - What the clinician wrote.
import {
	mysqlTable,
	mysqlEnum,
	varchar,
	int,
	text,
	datetime,
	index,
	type AnyMySqlColumn
} from 'drizzle-orm/mysql-core';
import { relations } from 'drizzle-orm';
import { secureFields } from './secureFields';
import { patient } from './patients';
import { provider } from './providers';
import { appointment } from './scheduling';

/**
 * One clinical note.
 *
 * `body` is `text`, not `varchar`, and that is an Amharic decision rather than a generic one.
 * Ge'ez is three bytes per character in UTF-8 — a note of 37 characters measured 89 bytes on
 * this database — so a `varchar(500)` sized by eye for English holds a third of what its author
 * expects and starts truncating mid-sentence. Clinicians here also switch between Amharic and
 * English inside one line, which is why there is no language column: it would be wrong half the
 * time. The database is `utf8mb4`; mixed script round-trips and `LIKE` over Amharic works,
 * both verified.
 *
 * **Signed notes are not edited.** A clinical note is the record of what was found and done, and
 * may end up being read years later by someone deciding whether care was reasonable. Once
 * `signedAt` is set the write path stops accepting changes; a correction becomes a new note with
 * `amendsId` pointing at the original, so the first version and the correction both survive and
 * the order is visible. This is not enforceable by a constraint — no CHECK can express "only
 * while another column is null" across updates — so it is the server's rule, stated here because
 * a rule whose reason is only in a route handler is one nobody knows to keep.
 */
export const clinicalNote = mysqlTable(
	'clinical_note',
	{
		id: int('id').primaryKey().autoincrement(),

		patientId: int('patient_id')
			.notNull()
			.references(() => patient.id, { onDelete: 'cascade' }),

		/** The visit this describes. Null for a telephone call or a note added between visits. */
		appointmentId: int('appointment_id').references(() => appointment.id, {
			onDelete: 'set null'
		}),

		/**
		 * Who wrote it. `set null` rather than cascade: a clinician leaving the clinic must not
		 * take the record of what they found with them.
		 */
		providerId: int('provider_id').references(() => provider.id, { onDelete: 'set null' }),

		/**
		 * `examination` — what was found
		 * `treatment`   — what was done
		 * `telephone`   — a call, which is a record too and the one most often lost
		 * `note`        — anything else
		 */
		kind: mysqlEnum('kind', ['examination', 'treatment', 'telephone', 'note'])
			.notNull()
			.default('note'),

		/** A one-line summary for a list view, so reading a history does not mean opening each note. */
		summary: varchar('summary', { length: 255 }),

		body: text('body').notNull(),

		/** Set when the author commits to it. After this the note is read-only — see above. */
		signedAt: datetime('signed_at'),

		/**
		 * The note this one corrects. A correction is an additional note, never an overwrite, so
		 * that what was originally recorded is still there to be read.
		 */
		amendsId: int('amends_id').references((): AnyMySqlColumn => clinicalNote.id, {
			onDelete: 'set null'
		}),

		...secureFields
	},
	(table) => [
		// A patient's history, newest first — the query behind the record screen.
		index('clinical_note_patient_idx').on(table.patientId, table.createdAt),
		index('clinical_note_appointment_idx').on(table.appointmentId),
		index('clinical_note_provider_idx').on(table.providerId)
	]
);

export const clinicalNoteRelations = relations(clinicalNote, ({ one }) => ({
	patient: one(patient, { fields: [clinicalNote.patientId], references: [patient.id] }),
	appointment: one(appointment, {
		fields: [clinicalNote.appointmentId],
		references: [appointment.id]
	}),
	provider: one(provider, { fields: [clinicalNote.providerId], references: [provider.id] })
}));
