// conditions.ts - What a patient has, as rows the government report can count.
import {
	mysqlTable,
	mysqlEnum,
	varchar,
	int,
	boolean,
	date,
	datetime,
	text,
	unique,
	index
} from 'drizzle-orm/mysql-core';
import { relations, sql } from 'drizzle-orm';
import { secureFields } from './secureFields';
import { patient } from './patients';
import { provider } from './providers';

/**
 * A medical condition or disease the clinic can record against a patient.
 *
 * Coded rather than left in prose for the same reason allergies were, plus a harder one: clinics
 * are required to report how many patients they saw with each condition, and a count cannot be
 * taken from a text box.
 *
 * **Two code columns, and the distinction matters more than it looks.** Ethiopia does not report
 * on raw ICD. The Ministry defined a National Classification of Diseases — roughly 126 entries,
 * each with a serial number as its code, mapped onto ICD-10 chapters, and now alongside an
 * Ethiopian Simplified Version of ICD-11. `hmisCode` is what a statutory return is built from;
 * `icdCode` is what an international source will give you. A table carrying only one of them
 * either cannot file the report or cannot be synced, so it carries both and they are filled from
 * different places.
 *
 * **Both are null in the seed, deliberately.** The NCoD list is the Ministry's and I do not have
 * it; inventing serial numbers for a regulatory return would be worse than leaving them empty,
 * because a wrong code files a wrong report silently while a null one is visibly unfinished. The
 * seeded names are unambiguous and useful the day they land — the codes come from the Ministry's
 * list or from the sync, and `source` below is what keeps that sync from trampling them.
 *
 * Recording the code is also known to be where this goes wrong in practice: providers frequently
 * apply the wrong HMIS diagnosis, and coding is error-prone where nobody has been trained on it.
 * That is what `isDentalRelated` is for — a dentist should be picking from a short list of things
 * they actually diagnose, not scrolling 126 entries looking for one.
 */
export const condition = mysqlTable(
	'condition',
	{
		id: int('id').primaryKey().autoincrement(),

		name: varchar('name', { length: 160 }).notNull().unique(),

		/** The Ministry's National Classification of Diseases code. What the statutory return uses. */
		hmisCode: varchar('hmis_code', { length: 16 }),

		/** The international code, from ICD-10 or ICD-11. What a sync will populate. */
		icdCode: varchar('icd_code', { length: 16 }),
		icdVersion: mysqlEnum('icd_version', ['icd10', 'icd11']),

		/** Chapter or grouping, for organising a long list. */
		category: varchar('category', { length: 80 }),

		/**
		 * Whether a dentist diagnoses this themselves.
		 *
		 * True for caries, pulpitis, periodontitis; false for diabetes and hypertension, which the
		 * clinic records because they change treatment but never diagnoses. The charting screen
		 * offers the first group; the medical-history screen offers everything.
		 */
		isDentalRelated: boolean('is_dental_related').notNull().default(false),

		/**
		 * Where this row came from, and the column that makes an automated refresh safe.
		 *
		 * A nightly job pulling from an external list must not overwrite a name a clinic corrected
		 * or delete a condition they added themselves. `seed` and `import` rows are the job's to
		 * manage; `clinic` rows are never touched. Without this a sync is a data-loss feature.
		 */
		source: mysqlEnum('source', ['seed', 'import', 'clinic']).notNull().default('clinic'),

		/** The id this row has in whatever system it was imported from, so a re-sync can match it. */
		externalId: varchar('external_id', { length: 64 }),
		lastSyncedAt: datetime('last_synced_at'),

		description: varchar('description', { length: 255 }),
		sortOrder: int('sort_order').notNull().default(0),

		...secureFields
	},
	(table) => [
		// The two lists the app offers: everything, and what a dentist diagnoses.
		index('condition_dental_idx').on(table.isDentalRelated, table.sortOrder),
		index('condition_hmis_idx').on(table.hmisCode),
		index('condition_external_idx').on(table.externalId)
	]
);

/**
 * One condition of one patient.
 *
 * The table the statutory count is taken from: patients per condition over a period is a group-by
 * here, which is the whole reason conditions stopped being a text field.
 *
 * `status` carries more weight than it does on an allergy. A resolved condition is not a deleted
 * one — a healed periapical abscess is history a clinician wants to see, and last year's
 * pregnancy must not appear as current. `suspected` exists because a dentist who sees signs of
 * undiagnosed diabetes should be able to record the suspicion without asserting a diagnosis they
 * are not licensed to make.
 *
 * `note` holds what a code cannot: "poorly controlled, last HbA1c 9.2", in whichever language it
 * was written. The same split as allergies — the substance is coded so it can be counted, the
 * clinical detail stays prose.
 */
export const patientConditions = mysqlTable(
	'patient_conditions',
	{
		id: int('id').primaryKey().autoincrement(),

		patientId: int('patient_id')
			.notNull()
			.references(() => patient.id, { onDelete: 'cascade' }),

		/** `restrict`: a row that cannot say which condition it is would still be counted. */
		conditionId: int('condition_id')
			.notNull()
			.references(() => condition.id),

		status: mysqlEnum('status', ['suspected', 'active', 'inRemission', 'resolved'])
			.notNull()
			.default('active'),

		diagnosedOn: date('diagnosed_on'),
		resolvedOn: date('resolved_on'),

		/** Who recorded it. `set null` — a clinician leaving does not erase what they found. */
		providerId: int('provider_id').references(() => provider.id, { onDelete: 'set null' }),

		note: text('note'),

		/**
		 * One live row per patient per condition, enforced in the database. Same generated-column
		 * trick as `patient_allergies.live_key`, for the same reason: a plain unique would make a
		 * soft-deleted condition impossible to re-record, and a patient listed as diabetic twice is
		 * counted twice in a return the Ministry reads. Never write to it.
		 */
		liveKey: int('live_key').generatedAlwaysAs(
			(): ReturnType<typeof sql> => sql`(if(\`deleted_at\` is null, \`condition_id\`, null))`,
			{ mode: 'virtual' }
		),

		...secureFields
	},
	(table) => [
		unique('patient_conditions_live_unique').on(table.patientId, table.liveKey),
		// "How many patients have this condition" — the statutory count.
		index('patient_conditions_condition_idx').on(table.conditionId, table.status),
		index('patient_conditions_patient_idx').on(table.patientId)
	]
);

export const conditionRelations = relations(condition, ({ many }) => ({
	patients: many(patientConditions)
}));

export const patientConditionsRelations = relations(patientConditions, ({ one }) => ({
	patient: one(patient, { fields: [patientConditions.patientId], references: [patient.id] }),
	condition: one(condition, {
		fields: [patientConditions.conditionId],
		references: [condition.id]
	}),
	provider: one(provider, { fields: [patientConditions.providerId], references: [provider.id] })
}));
