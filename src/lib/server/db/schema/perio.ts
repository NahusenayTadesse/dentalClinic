// perio.ts - The periodontal chart: pockets, recession, bleeding and mobility, per visit.
import {
	mysqlTable,
	mysqlEnum,
	int,
	smallint,
	tinyint,
	boolean,
	date,
	datetime,
	text,
	index,
	uniqueIndex
} from 'drizzle-orm/mysql-core';
import { secureFields } from './secureFields';
import { branchRef } from './branches';
import { patient } from './patients';
import { provider } from './providers';
import { appointment } from './scheduling';
import { tooth } from './teeth';

/**
 * One periodontal examination: a full-mouth charting on one day. The readings are its children —
 * `perio_tooth` and `perio_site` — and the rules for them are `$lib/perio.ts`.
 *
 * **A finished exam is not changed**, for the reason a signed note is not: the next exam is
 * compared against this one, and a baseline that moves afterwards makes every comparison a lie.
 * Until `completedAt` is set it is a draft the clinician fills in over the visit; after it, a
 * mistake is put right by charting again. The server enforces it (`server/perio.ts`).
 *
 * All 32 adult teeth get their rows when the exam starts, so a save is updates only and the
 * comparison never meets a tooth that is simply absent from the table.
 */
export const perioExam = mysqlTable(
	'perio_exam',
	{
		id: int('id').primaryKey().autoincrement(),

		patientId: int('patient_id')
			.notNull()
			.references(() => patient.id, { onDelete: 'cascade' }),

		/** Who probed. `set null`: a clinician leaving must not take the record with them. */
		providerId: int('provider_id').references(() => provider.id, { onDelete: 'set null' }),

		/** The visit it was taken at, when there was one. */
		appointmentId: int('appointment_id').references(() => appointment.id, {
			onDelete: 'set null'
		}),

		/** Where it was taken. The record is the patient's whichever branch it was taken at. */
		branchId: branchRef(),

		/** The clinic day it was taken. */
		examinedOn: date('examined_on', { mode: 'string' }).notNull(),

		/** Set when the clinician finishes it. After this it is read-only — see above. */
		completedAt: datetime('completed_at'),

		/** What the numbers do not say: "smoker, 20 a day", "referred to periodontist". */
		notes: text('notes'),

		...secureFields
	},
	(table) => [
		index('perio_exam_patient_idx').on(table.patientId, table.examinedOn),
		index('perio_exam_provider_idx').on(table.providerId)
	]
);

/** The whole-tooth readings of one exam: whether it is there, how loose, and its furcation. */
export const perioTooth = mysqlTable(
	'perio_tooth',
	{
		id: int('id').primaryKey().autoincrement(),
		examId: int('exam_id')
			.notNull()
			.references(() => perioExam.id, { onDelete: 'cascade' }),
		toothId: smallint('tooth_id')
			.notNull()
			.references(() => tooth.id),
		missing: boolean('missing').notNull().default(false),
		/** Miller's grades 0–3. Null when not tested. */
		mobility: tinyint('mobility'),
		/** Glickman's grades 0–3, on teeth with more than one root. Null when not tested. */
		furcation: tinyint('furcation')
	},
	(table) => [uniqueIndex('perio_tooth_exam_tooth_unique').on(table.examId, table.toothId)]
);

/** One site's readings in one exam. Six a tooth. */
export const perioSite = mysqlTable(
	'perio_site',
	{
		id: int('id').primaryKey().autoincrement(),
		examId: int('exam_id')
			.notNull()
			.references(() => perioExam.id, { onDelete: 'cascade' }),
		toothId: smallint('tooth_id')
			.notNull()
			.references(() => tooth.id),
		site: mysqlEnum('site', ['DB', 'B', 'MB', 'DL', 'L', 'ML']).notNull(),
		/** Probing depth in millimetres, gum margin to the base of the pocket. */
		depth: tinyint('depth'),
		/** Gum margin below the enamel junction, in millimetres; negative when above it. */
		recession: tinyint('recession'),
		bleeding: boolean('bleeding').notNull().default(false),
		plaque: boolean('plaque').notNull().default(false)
	},
	(table) => [
		uniqueIndex('perio_site_exam_tooth_site_unique').on(table.examId, table.toothId, table.site)
	]
);
