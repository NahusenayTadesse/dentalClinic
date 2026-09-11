// medications.ts - What the patient is already taking.
import {
	mysqlTable,
	mysqlEnum,
	varchar,
	int,
	date,
	text,
	unique,
	index
} from 'drizzle-orm/mysql-core';
import { relations, sql } from 'drizzle-orm';
import { secureFields } from './secureFields';
import { patient } from './patients';
import { provider } from './providers';
import { medicine } from './prescriptions';

/**
 * A medicine a patient is taking, whoever prescribed it.
 *
 * The third leg of a medical history, and the one that was missing. `patient_allergies` says what
 * they react to, `patient_conditions` says what they have, and this says what they are on — which
 * is not derivable from either. A patient with no recorded condition can still be on warfarin,
 * because the cardiologist who started it is not this clinic and never will be.
 *
 * It is also the leg with the sharpest consequences for a dentist specifically. The three flags
 * on `medicine` exist for this table: a patient on an anticoagulant bleeds after an extraction,
 * one on a bisphosphonate risks osteonecrosis of the jaw from the same extraction, and one on
 * steroids or methotrexate heals slowly and infects easily. None of that is visible from a
 * condition list.
 *
 * **`nameAsReported` is notNull and `medicineId` is not.** That ordering is deliberate and is the
 * opposite of how allergies work. Patients frequently cannot name what they take — "the white
 * tablet for my heart, from Black Lion" is a real and common answer — and a system that refuses
 * to record anything until someone identifies the drug records nothing at all. So what the
 * patient said is always kept, and the coded link is added when it can be. An uncoded row still
 * warns a clinician to ask; a missing row does not.
 */
export const patientMedications = mysqlTable(
	'patient_medications',
	{
		id: int('id').primaryKey().autoincrement(),

		patientId: int('patient_id')
			.notNull()
			.references(() => patient.id, { onDelete: 'cascade' }),

		/**
		 * The coded drug, when it could be identified. `restrict`: a row pointing at a
		 * hard-deleted medicine would carry its risk flags away with it, and the flags are the
		 * reason this table exists. Retiring a medicine is a soft delete.
		 */
		medicineId: int('medicine_id').references(() => medicine.id),

		/** What the patient actually said. Always recorded, even when coded — see above. */
		nameAsReported: varchar('name_as_reported', { length: 160 }).notNull(),

		dose: varchar('dose', { length: 50 }),
		frequency: varchar('frequency', { length: 80 }),

		/**
		 * `active`  — taking it now
		 * `stopped` — no longer taking it, kept because it still matters: a bisphosphonate stopped
		 *             last year does not stop being a risk, which is exactly the case a deleted
		 *             row would hide
		 * `unknown` — they think they still take it but are not sure, which is honest and common
		 */
		status: mysqlEnum('status', ['active', 'stopped', 'unknown']).notNull().default('active'),

		startedOn: date('started_on'),
		stoppedOn: date('stopped_on'),

		/** Who wrote it down. `set null` — a clinician leaving does not erase the history. */
		providerId: int('provider_id').references(() => provider.id, { onDelete: 'set null' }),

		/** "Patient unsure of the name", "prescription seen", "from Black Lion cardiology". */
		note: text('note'),

		/**
		 * One live row per patient per *coded* medicine. Same generated-column trick as
		 * `patient_allergies.live_key`.
		 *
		 * Uncoded rows are deliberately exempt: `medicine_id` is null, so `live_key` is null, and
		 * NULLs do not collide. That is correct rather than a gap — two rows reading "white tablet
		 * for blood pressure" and "something for my heart" may well be two different drugs, and
		 * refusing the second would lose a medicine the dentist needed to know about.
		 */
		liveKey: int('live_key').generatedAlwaysAs(
			(): ReturnType<typeof sql> => sql`(if(\`deleted_at\` is null, \`medicine_id\`, null))`,
			{ mode: 'virtual' }
		),

		...secureFields
	},
	(table) => [
		unique('patient_medications_live_unique').on(table.patientId, table.liveKey),
		index('patient_medications_patient_idx').on(table.patientId, table.status),
		// "Who is on an anticoagulant" — a recall, or a morning list checked before surgery.
		index('patient_medications_medicine_idx').on(table.medicineId)
	]
);

export const patientMedicationsRelations = relations(patientMedications, ({ one }) => ({
	patient: one(patient, { fields: [patientMedications.patientId], references: [patient.id] }),
	medicine: one(medicine, { fields: [patientMedications.medicineId], references: [medicine.id] }),
	provider: one(provider, { fields: [patientMedications.providerId], references: [provider.id] })
}));
