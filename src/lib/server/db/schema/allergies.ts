// allergies.ts - What a patient reacts to, as rows rather than prose.
import { mysqlTable, mysqlEnum, varchar, int, unique, index } from 'drizzle-orm/mysql-core';
import { relations, sql } from 'drizzle-orm';
import { secureFields } from './secureFields';
import { patient } from './patients';

/**
 * A substance a patient can react to.
 *
 * `patient.allergies` was a `text` column for exactly one commit. The argument for prose was
 * that a picker missing what the patient just said gets filled in as "other" — which is true,
 * and is answered below by `reaction` rather than by giving up on coding the substance.
 *
 * What prose cannot do is answer a question. "Which patients are allergic to penicillin" is not
 * a report, it is what you ask when a batch is recalled or a clinician wants their afternoon
 * list checked, and `LIKE '%penicillin%'` is not an answer — it misses "Pen V", "penicilin",
 * and the note that says *not* allergic to penicillin. A coded substance is the only version of
 * this that is safe to rely on.
 *
 * Extendable the same way `contact_types` is: a clinic adds a row in the admin panel. Unlike a
 * contact channel, adding one here has clinical weight, so the seeded list covers what a dental
 * clinic actually meets and the rest is deliberate.
 */
export const allergen = mysqlTable('allergen', {
	id: int('id').primaryKey().autoincrement(),
	name: varchar('name', { length: 80 }).notNull().unique(),

	/**
	 * Grouping for the picker and for reports, not a clinical classification — a clinician
	 * scanning a list wants the drugs together. `anaesthetic` is split out of `medication`
	 * because in a dental clinic it is the one that stops the appointment.
	 */
	category: mysqlEnum('category', [
		'medication',
		'anaesthetic',
		'material',
		'food',
		'environmental',
		'other'
	])
		.notNull()
		.default('other'),

	description: varchar('description', { length: 255 }),

	/** Display order in the picker, so the common ones are not buried alphabetically. */
	sortOrder: int('sort_order').notNull().default(0),

	...secureFields
});

/**
 * One allergy of one patient.
 *
 * The split that resolves the coded-versus-prose argument: the **substance is coded** so it can
 * be joined, counted and filtered, while the **reaction is prose** because "came out in hives
 * after the second day" is the clinically useful bit and no picker will ever hold it. Coding the
 * substance loses nothing, since the words the patient used go in `reaction`.
 *
 * Absence of rows means "no known allergies" only when `patient.historyTakenAt` is set. With it
 * null, an empty list means nobody has asked — the same distinction the old text column carried,
 * except now it is a join rather than a null check, and it is queryable across every patient at
 * once.
 */
export const patientAllergies = mysqlTable(
	'patient_allergies',
	{
		id: int('id').primaryKey().autoincrement(),
		patientId: int('patient_id')
			.notNull()
			.references(() => patient.id, { onDelete: 'cascade' }),

		/**
		 * `restrict`. An allergy row whose substance has been hard-deleted is worse than no row:
		 * it reads as "this patient has an allergy" while being unable to say to what. Retiring a
		 * substance is a soft delete on `allergen`, which leaves every existing row readable.
		 */
		allergenId: int('allergen_id')
			.notNull()
			.references(() => allergen.id),

		/**
		 * How bad the reaction is. `unknown` is the honest default and the common one — most
		 * patients report an allergy without being able to grade it, and forcing a guess would
		 * make `severe` mean nothing.
		 *
		 * An enum, not a lookup like `allergen`: a clinic may add substances, but inventing a
		 * fifth severity would silently break every filter and sort that depends on the order of
		 * these four.
		 */
		severity: mysqlEnum('severity', ['unknown', 'mild', 'moderate', 'severe'])
			.notNull()
			.default('unknown'),

		/**
		 * What actually happens — rash, swelling, breathing trouble, anaphylaxis — in whoever's
		 * words describe it best. This is the field the old free-text column was really for, and
		 * the reason coding the substance costs nothing.
		 */
		reaction: varchar('reaction', { length: 255 }),

		/**
		 * Enforces "one live allergy per patient per substance" in the database rather than in the
		 * write path, which is the whole point: an app-level rule is one forgotten code path away
		 * from a duplicate, and a list that says penicillin twice is a list nobody trusts.
		 *
		 * Plain `unique(patientId, allergenId)` cannot work alongside soft delete — removing an
		 * allergy and later re-recording it would collide with the dead row forever. This column
		 * is the allergen id while the row is live and NULL once it is deleted, and MySQL treats
		 * NULLs in a unique index as distinct, so any number of deleted rows coexist while only
		 * one live row is allowed. The partial unique index MySQL does not have, in other words.
		 *
		 * Virtual, not stored: it is derived from two columns in the same row, so there is nothing
		 * to keep in sync and no write cost. Never write to it.
		 */
		liveKey: int('live_key').generatedAlwaysAs(
			(): ReturnType<typeof sql> => sql`(if(\`deleted_at\` is null, \`allergen_id\`, null))`,
			{ mode: 'virtual' }
		),

		...secureFields
	},
	(table) => [
		unique('patient_allergies_live_unique').on(table.patientId, table.liveKey),
		// "Who reacts to this substance" is the query this table exists to make possible.
		index('patient_allergies_allergen_idx').on(table.allergenId),
		index('patient_allergies_patient_idx').on(table.patientId)
	]
);

export const allergenRelations = relations(allergen, ({ many }) => ({
	patientAllergies: many(patientAllergies)
}));

export const patientAllergiesRelations = relations(patientAllergies, ({ one }) => ({
	patient: one(patient, { fields: [patientAllergies.patientId], references: [patient.id] }),
	allergen: one(allergen, { fields: [patientAllergies.allergenId], references: [allergen.id] })
}));
