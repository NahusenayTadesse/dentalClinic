// attendance.ts - When each member of staff came in and left.
import {
	mysqlTable,
	mysqlEnum,
	int,
	date,
	time,
	varchar,
	index,
	unique
} from 'drizzle-orm/mysql-core';
import { relations, sql } from 'drizzle-orm';
import { secureFields } from './secureFields';
import { branchRef } from './branches';
import { employee } from './staff';

/**
 * One member of staff on one day: the clock times they came in and left, or an absence excused
 * with its reason.
 *
 * **An absence is not a row.** It is a scheduled working day (`staff_schedule`) with nothing
 * recorded here, no approved leave and no closure — derived by `$lib/attendance.ts` and
 * `server/attendance.ts`, and deducted by payroll. It replaced `missing_days`, where absence was
 * typed in as its own row: a day nobody remembered to write down was a day paid, and the screen
 * could never show who simply did not come.
 *
 * **Clinic wall-clock times, not instants.** `clock_in` is "08:42" at the clinic, with `day` the
 * clinic's date — the way a register is kept and read. Comparing it with `staff_schedule`'s times
 * needs no time zone, and neither does a night that never crosses midnight (CLAUDE.md §9).
 *
 * `status`:
 *   `present` — came in; `clock_in` is set, `clock_out` once they leave
 *   `excused` — did not come, for a reason the clinic accepts; `note` says what. Not deducted.
 *
 * Audited: it decides pay (CLAUDE.md §11).
 */
export const attendance = mysqlTable(
	'attendance',
	{
		id: int('id').primaryKey().autoincrement(),
		staffId: int('staff_id')
			.notNull()
			.references(() => employee.id, { onDelete: 'cascade' }),
		/** Where they worked that day — the branch whose register it is (§15). */
		branchId: branchRef(),
		/** The clinic's calendar day. */
		day: date('day', { mode: 'string' }).notNull(),
		status: mysqlEnum('status', ['present', 'excused']).notNull().default('present'),
		/** `HH:MM:SS`, clinic time. */
		clockIn: time('clock_in'),
		clockOut: time('clock_out'),
		note: varchar('note', { length: 255 }),

		/**
		 * One live row per person per day. The `live_key` trick of `patient_allergies`: the day
		 * while the row is live, null once soft-deleted, so a cleared day can be recorded again.
		 */
		liveDay: date('live_day', { mode: 'string' }).generatedAlwaysAs(
			(): ReturnType<typeof sql> => sql`(if(\`deleted_at\` is null, \`day\`, null))`,
			{ mode: 'virtual' }
		),

		...secureFields
	},
	(table) => [
		unique('attendance_staff_live_day').on(table.staffId, table.liveDay),
		// The register and the month grid: everyone at a branch over a range of days.
		index('attendance_branch_day_idx').on(table.branchId, table.day),
		index('attendance_day_idx').on(table.day)
	]
);

export const attendanceRelations = relations(attendance, ({ one }) => ({
	staff: one(employee, { fields: [attendance.staffId], references: [employee.id] })
}));
