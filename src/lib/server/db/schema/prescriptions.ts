// prescriptions.ts - What was prescribed, to whom, and why.
import {
	mysqlTable,
	mysqlEnum,
	varchar,
	int,
	text,
	date,
	decimal,
	boolean,
	index
} from 'drizzle-orm/mysql-core';
import { relations } from 'drizzle-orm';
import { secureFields } from './secureFields';
import { branchRef } from './branches';
import { patient } from './patients';
import { provider } from './providers';
import { appointment } from './scheduling';

/**
 * A medicine the clinic prescribes.
 *
 * **Keyed on the generic name**, because that is how prescribing is done here: 77% of private
 * prescriptions and 97% in public facilities are written generically, and the Ethiopian
 * Essential Medicines List — maintained by EFDA under Proclamation 1112/2019 — is the reference
 * a pharmacy works from. `brandName` exists for the cases where a clinic stocks or a patient
 * asks for a particular one, and it is deliberately the secondary field.
 *
 * `isAntibiotic` is not decoration. A study of dental patients in Mekelle found antibiotics
 * prescribed to 89% of them, and judged three quarters of that prescribing inappropriate — most
 * often antibiotics given for dental conditions showing no systemic signs. A clinic cannot see
 * that about itself without a flag to count, and `prescription.indication` below is the other
 * half of the same measurement.
 */
export const medicine = mysqlTable(
	'medicine',
	{
		id: int('id').primaryKey().autoincrement(),

		/** The INN. What goes on the prescription. */
		genericName: varchar('generic_name', { length: 120 }).notNull().unique(),

		/** Only if it matters. The pharmacy dispenses on the generic name. */
		brandName: varchar('brand_name', { length: 120 }),

		/** "500mg", "0.2%", "125mg/5ml". Free text because the forms vary more than a column can. */
		strength: varchar('strength', { length: 50 }),

		form: mysqlEnum('form', [
			'tablet',
			'capsule',
			'syrup',
			'suspension',
			'injection',
			'mouthwash',
			'gel',
			'cream',
			'other'
		])
			.notNull()
			.default('tablet'),

		/** Counted, so a clinic can measure its own prescribing. See the note above. */
		isAntibiotic: boolean('is_antibiotic').notNull().default(false),

		/**
		 * Whether this clinic prescribes it.
		 *
		 * False for everything that only ever appears in a patient's existing medication list —
		 * warfarin, metformin, alendronate. A dental clinic does not prescribe those, but it has to
		 * be able to *record* them, and the catalogue serves both jobs. Without the flag the
		 * prescribing picker slowly fills with cardiology drugs and a tired clinician eventually
		 * picks one.
		 */
		isPrescribable: boolean('is_prescribable').notNull().default(true),

		/**
		 * The three properties of a drug that change what a dentist does, each mapping to a
		 * distinct action rather than a general warning.
		 *
		 *   `bleedingRisk`      — anticoagulants and antiplatelets. Check before extracting; local
		 *                         measures, and do not stop the drug without the prescriber.
		 *   `osteonecrosisRisk` — bisphosphonates and denosumab. An extraction can cause
		 *                         medication-related osteonecrosis of the jaw, which is why this is
		 *                         its own flag and not lumped with the others.
		 *   `immunosuppression` — steroids, methotrexate, chemotherapy. Healing and infection.
		 *
		 * Flags on the medicine rather than on the patient's row, because they are facts about the
		 * drug. Three booleans rather than a drug-class table: the list of classes a dentist acts
		 * on is short, closed and stable, and a lookup would add two tables and a join to a query
		 * that runs on every chairside screen.
		 */
		bleedingRisk: boolean('bleeding_risk').notNull().default(false),
		osteonecrosisRisk: boolean('osteonecrosis_risk').notNull().default(false),
		immunosuppression: boolean('immunosuppression').notNull().default(false),

		/** Whether it appears on the Ethiopian Essential Medicines List. */
		isOnEml: boolean('is_on_eml').notNull().default(true),

		/** Cautions worth putting in front of whoever is prescribing. */
		notes: varchar('notes', { length: 255 }),

		sortOrder: int('sort_order').notNull().default(0),

		...secureFields
	},
	(table) => [
		index('medicine_antibiotic_idx').on(table.isAntibiotic),
		// The prescribing picker, which must not offer drugs this clinic never writes.
		index('medicine_prescribable_idx').on(table.isPrescribable, table.sortOrder)
	]
);

/**
 * One prescription — one sheet of paper, with one or more medicines on it.
 *
 * The columns follow the Ethiopian prescription form, which asks for the institution, the
 * patient's name, **sex, age and weight**, the card number, and the address down to kebele. Most
 * of that is a join away: `branch` is the institution, `patient` carries name, sex, `fileNo` as
 * the card number, and the address. Two things are not.
 *
 * **`patientWeightKg`** is the first. Weight is on the form because it is how a paediatric dose
 * is worked out, it is not on the patient record because it changes, and a weight taken on the
 * day is the only one worth dosing from. Recorded here, with the prescription it belongs to.
 *
 * Age is deliberately **not** stored, though the form asks for it. It is derivable from
 * `patient.birthDate` when that is known, and when it is not — which is common, hence
 * `birthDateEstimated` on the patient — an age column would just be a second place for a guess
 * to live and disagree. The printed form leaves it blank, which is the honest answer.
 *
 * **`indication`** is the second, and is the column this table exists to make possible. Writing
 * down what the medicine is *for* is what turns a stack of prescriptions into something a clinic
 * can review, and given how much dental antibiotic prescribing here is judged inappropriate,
 * being able to ask "what were we treating" is worth one required field.
 *
 * Not enforced by a constraint: that the prescriber holds `provider.canPrescribe`. No CHECK can
 * reach another table, so the write path owns it — one of the few rules here that the database
 * cannot keep on its own.
 */
export const prescription = mysqlTable(
	'prescription',
	{
		id: int('id').primaryKey().autoincrement(),

		patientId: int('patient_id')
			.notNull()
			.references(() => patient.id, { onDelete: 'cascade' }),

		/**
		 * Who prescribed. `set null`, not cascade: a prescription is a record of what a patient was
		 * given and must outlive the clinician's employment.
		 */
		providerId: int('provider_id').references(() => provider.id, { onDelete: 'set null' }),

		appointmentId: int('appointment_id').references(() => appointment.id, {
			onDelete: 'set null'
		}),

		/** The institution line on the printed form. */
		branchId: branchRef(),

		prescribedOn: date('prescribed_on').notNull(),

		/** Kilograms, as taken on the day. See above for why it lives here and not on the patient. */
		patientWeightKg: decimal('patient_weight_kg', { precision: 5, scale: 2, mode: 'number' }),

		/** What it is being treated. Required in practice; the whole audit rests on it. */
		indication: varchar('indication', { length: 255 }),

		notes: text('notes'),

		...secureFields
	},
	(table) => [
		index('prescription_patient_idx').on(table.patientId, table.prescribedOn),
		index('prescription_provider_idx').on(table.providerId, table.prescribedOn),
		index('prescription_appointment_idx').on(table.appointmentId)
	]
);

/**
 * One line on the prescription.
 *
 * `dose`, `frequency` and `instructions` are free text on purpose. A picker of coded frequencies
 * works where everybody writes "TID"; here a clinician may write "TID", "three times a day", or
 * the same thing in Amharic, and the instruction the patient actually reads — after food, not
 * with milk — is prose in whichever language they read. Coding it would lose the instruction to
 * save a join nobody needs. The **medicine** is coded, which is the part that has to be counted.
 */
export const prescriptionItem = mysqlTable(
	'prescription_item',
	{
		id: int('id').primaryKey().autoincrement(),

		prescriptionId: int('prescription_id')
			.notNull()
			.references(() => prescription.id, { onDelete: 'cascade' }),

		/** `restrict`: a line that cannot say which medicine it is would be dangerous, not merely empty. */
		medicineId: int('medicine_id')
			.notNull()
			.references(() => medicine.id),

		/** "500mg", "one tablet". */
		dose: varchar('dose', { length: 50 }),

		/** "TID", "three times daily", "በቀን ሦስት ጊዜ". */
		frequency: varchar('frequency', { length: 80 }),

		durationDays: int('duration_days'),

		/** "21 tablets" — what the pharmacy hands over. */
		quantity: varchar('quantity', { length: 50 }),

		/** What the patient is told. Whichever language they read. */
		instructions: text('instructions'),

		...secureFields
	},
	(table) => [
		index('prescription_item_prescription_idx').on(table.prescriptionId),
		// "How much amoxicillin did we prescribe this quarter" — the stewardship query.
		index('prescription_item_medicine_idx').on(table.medicineId)
	]
);

export const medicineRelations = relations(medicine, ({ many }) => ({
	items: many(prescriptionItem)
}));

export const prescriptionRelations = relations(prescription, ({ one, many }) => ({
	patient: one(patient, { fields: [prescription.patientId], references: [patient.id] }),
	provider: one(provider, { fields: [prescription.providerId], references: [provider.id] }),
	appointment: one(appointment, {
		fields: [prescription.appointmentId],
		references: [appointment.id]
	}),
	items: many(prescriptionItem)
}));

export const prescriptionItemRelations = relations(prescriptionItem, ({ one }) => ({
	prescription: one(prescription, {
		fields: [prescriptionItem.prescriptionId],
		references: [prescription.id]
	}),
	medicine: one(medicine, { fields: [prescriptionItem.medicineId], references: [medicine.id] })
}));
