// consents.ts - What the patient agreed to, and how that was established.
import { mysqlTable, mysqlEnum, varchar, int, date, text, index } from 'drizzle-orm/mysql-core';
import { relations } from 'drizzle-orm';
import { secureFields } from './secureFields';
import { patient } from './patients';
import { provider } from './providers';
import { procedures } from './procedures';
import { patientFile } from './patientFiles';

/**
 * A record that consent was given, separate from the paper it was given on.
 *
 * A scanned form already fits in `patient_file` with `kind = 'consent'`, and for a great many
 * clinics that is the whole of it. What a file cannot do is answer a question: *was* there consent
 * for this extraction, is it still current, and who witnessed it. Those are asked exactly once —
 * when something has gone wrong — and searching a folder of photographs is not an answer.
 *
 * **`method` is the field that makes this fit Ethiopia rather than a textbook.** Written consent
 * assumes a patient who reads, and a meaningful number do not. Verbal consent given before a
 * witness is how it actually happens, it is legitimate, and a schema that only recorded signatures
 * would push clinics into either lying or recording nothing. `witnessedBy` carries the weight that
 * a signature carries elsewhere, which is why it matters most on exactly those rows.
 *
 * **`givenBy` and `relationship` exist for children**, who are a large share of a dental clinic's
 * work here. A seven-year-old cannot consent to an extraction; the parent does, and the record has
 * to say which parent rather than implying the patient agreed to something themselves.
 *
 * Consent can be withdrawn, so it is a state and not an event — `withdrawnOn` rather than deleting
 * the row, because "she agreed in March and changed her mind in June" is the history, and a
 * deleted row reads as though she never agreed at all.
 */
export const patientConsent = mysqlTable(
	'patient_consent',
	{
		id: int('id').primaryKey().autoincrement(),

		patientId: int('patient_id')
			.notNull()
			.references(() => patient.id, { onDelete: 'cascade' }),

		/**
		 * The specific treatment consented to. Null for the standing kinds — consent to be treated
		 * at all, or to have photographs taken — which are not about one procedure.
		 */
		procedureId: int('procedure_id').references(() => procedures.id, { onDelete: 'set null' }),

		/**
		 * `treatment`   — general consent to be treated here
		 * `surgical`    — extraction and anything that opens tissue. The one that gets asked about
		 * `anaesthetic` — sedation or general anaesthetic, where the risks are separate
		 * `radiograph`  — imaging
		 * `photography` — clinical photographs, which often end up being used for teaching
		 * `dataSharing` — sharing records with an employer, insurer or another clinic
		 */
		consentType: mysqlEnum('consent_type', [
			'treatment',
			'surgical',
			'anaesthetic',
			'radiograph',
			'photography',
			'dataSharing'
		]).notNull(),

		/**
		 * How it was established. `verbal` is not a lesser record — see the note above — but it is
		 * the one where `witnessedBy` stops being optional in practice.
		 */
		method: mysqlEnum('method', ['written', 'verbal', 'electronic']).notNull().default('written'),

		givenOn: date('given_on').notNull(),

		/** Who agreed. The patient, or the parent or guardian who agreed on their behalf. */
		givenBy: varchar('given_by', { length: 150 }),

		/** Their relationship to the patient, when it is not the patient. "Mother", "guardian". */
		relationship: varchar('relationship', { length: 50 }),

		/** The clinician who took it, and who stands behind a verbal consent. */
		witnessedBy: int('witnessed_by').references(() => provider.id, { onDelete: 'set null' }),

		/** The signed form, where there is one. Points at the file rather than duplicating it. */
		documentFileId: int('document_file_id').references(() => patientFile.id, {
			onDelete: 'set null'
		}),

		/** Withdrawn rather than deleted, so the history reads honestly. */
		withdrawnOn: date('withdrawn_on'),
		withdrawnReason: varchar('withdrawn_reason', { length: 255 }),

		note: text('note'),

		...secureFields
	},
	(table) => [
		// "Is there current consent of this kind for this patient" — the question before surgery.
		index('patient_consent_patient_type_idx').on(table.patientId, table.consentType),
		index('patient_consent_procedure_idx').on(table.procedureId)
	]
);

export const patientConsentRelations = relations(patientConsent, ({ one }) => ({
	patient: one(patient, { fields: [patientConsent.patientId], references: [patient.id] }),
	procedure: one(procedures, {
		fields: [patientConsent.procedureId],
		references: [procedures.id]
	}),
	witness: one(provider, { fields: [patientConsent.witnessedBy], references: [provider.id] }),
	document: one(patientFile, {
		fields: [patientConsent.documentFileId],
		references: [patientFile.id]
	})
}));
