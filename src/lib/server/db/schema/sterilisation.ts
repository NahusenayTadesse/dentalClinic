// sterilisation.ts - Autoclave cycles, the instrument packs they made, and who each pack was used on.
import {
	mysqlTable,
	mysqlEnum,
	int,
	varchar,
	date,
	datetime,
	decimal,
	text,
	index,
	uniqueIndex
} from 'drizzle-orm/mysql-core';
import { secureFields } from './secureFields';
import { branchRef } from './branches';
import { patient } from './patients';
import { appointment } from './scheduling';
// Relative, not `$lib/…`: drizzle-kit loads the schema without SvelteKit's aliases.
import { CYCLE_KINDS, INDICATOR_RESULTS } from '../../../sterilisation';

/**
 * A steriliser: an autoclave or a dry-heat oven, at a branch. Reference data, edited under Clinic
 * Setup → Sterilisers. A retired machine keeps its cycles.
 */
export const steriliser = mysqlTable('steriliser', {
	id: int('id').primaryKey().autoincrement(),
	name: varchar('name', { length: 100 }).notNull(),
	kind: mysqlEnum('kind', ['autoclaveB', 'autoclaveN', 'autoclaveS', 'dryHeat'])
		.notNull()
		.default('autoclaveB'),
	serialNo: varchar('serial_no', { length: 60 }),
	branchId: branchRef(),
	...secureFields
});

/**
 * One run of a steriliser. The rules are `$lib/sterilisation.ts`'s; `status` is derived from the
 * two indicators on every write (`cycleStatus`) and stored so the log and the recall can filter on
 * it.
 *
 * `cycleNo` counts per steriliser, as the machine's own counter does, so the log matches the
 * printout taped beside it. Who ran it is `createdBy`.
 */
export const sterilisationCycle = mysqlTable(
	'sterilisation_cycle',
	{
		id: int('id').primaryKey().autoincrement(),
		steriliserId: int('steriliser_id')
			.notNull()
			.references(() => steriliser.id),
		branchId: branchRef(),
		cycleNo: int('cycle_no').notNull(),
		kind: mysqlEnum('kind', CYCLE_KINDS).notNull().default('load'),
		ranAt: datetime('ran_at').notNull(),
		/** As the machine names it: "134 °C · 4 min", "Prion". */
		program: varchar('program', { length: 60 }),
		temperatureC: decimal('temperature_c', { precision: 4, scale: 1, mode: 'number' }),
		holdMinutes: int('hold_minutes'),
		chemicalIndicator: mysqlEnum('chemical_indicator', INDICATOR_RESULTS).notNull().default('none'),
		biologicalIndicator: mysqlEnum('biological_indicator', INDICATOR_RESULTS)
			.notNull()
			.default('none'),
		/** When the spore test was read, which is not when the cycle ran. */
		biologicalReadAt: datetime('biological_read_at'),
		status: mysqlEnum('status', ['passed', 'failed', 'pending']).notNull(),
		note: text('note'),
		...secureFields
	},
	(table) => [
		uniqueIndex('sterilisation_cycle_number_unique').on(table.steriliserId, table.cycleNo),
		index('sterilisation_cycle_branch_ran_idx').on(table.branchId, table.ranAt)
	]
);

/**
 * A wrapped pack of instruments from a cycle, with the code on its label. Made when the cycle is
 * recorded; never edited after — a pack that expires is resterilised, which is a new pack.
 */
export const instrumentPack = mysqlTable(
	'instrument_pack',
	{
		id: int('id').primaryKey().autoincrement(),
		cycleId: int('cycle_id')
			.notNull()
			.references(() => sterilisationCycle.id),
		code: varchar('code', { length: 30 }).notNull(),
		/** What is in it, as the label says: "Exam kit", "Extraction set". */
		contents: varchar('contents', { length: 100 }),
		expiresOn: date('expires_on', { mode: 'string' }).notNull(),
		...secureFields
	},
	(table) => [
		uniqueIndex('instrument_pack_code_unique').on(table.code),
		index('instrument_pack_cycle_idx').on(table.cycleId)
	]
);

/**
 * A pack opened for a patient. One use a pack — the unique key is the database's guarantee — and
 * the patient it names is who is called if the pack's cycle fails afterwards.
 */
export const packUse = mysqlTable(
	'pack_use',
	{
		id: int('id').primaryKey().autoincrement(),
		packId: int('pack_id')
			.notNull()
			.references(() => instrumentPack.id),
		patientId: int('patient_id')
			.notNull()
			.references(() => patient.id, { onDelete: 'cascade' }),
		appointmentId: int('appointment_id').references(() => appointment.id, {
			onDelete: 'set null'
		}),
		usedAt: datetime('used_at').notNull(),
		...secureFields
	},
	(table) => [
		uniqueIndex('pack_use_pack_unique').on(table.packId),
		index('pack_use_patient_idx').on(table.patientId)
	]
);
