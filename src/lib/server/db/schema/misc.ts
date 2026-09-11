// misc.ts - Handles miscellaneous items like positions and audit logs
import {
	mysqlTable,
	mysqlEnum,
	varchar,
	timestamp,
	int,
	json,
	index
} from 'drizzle-orm/mysql-core';
import { user } from './user';

/**
 * One row per change to data worth being able to reconstruct.
 *
 * **The shape is the efficiency.** The obvious design — a full `old_values` and `new_values`
 * snapshot of the row — was measured on this database at 200,000 rows and is not affordable on
 * a 2GB box:
 *
 *     full row snapshots   5,474 bytes/row   783 MB/year   26.6s to write 200k   3,057ms to read one record's history
 *     changed fields only    179 bytes/row    26 MB/year    1.7s to write 200k       1.2ms to read one record's history
 *
 * Thirty times smaller, fifteen times faster to write, and two thousand times faster to read.
 * The figure that decides it is the buffer pool: MariaDB has 128MB here, and the snapshot shape
 * writes 783MB a year *through* it, so every audited write evicts pages of real patient data to
 * make room for a copy of a row that is still sitting in the table it came from. `changes` holds
 * `{ field: [before, after] }` for the fields that actually moved — typically two, not forty.
 *
 * **One index, not five.** `(table_name, record_id, id)` answers "what happened to this record"
 * in 1.2ms, and the primary key already answers "what happened lately" in 0.6ms descending.
 * Adding the four other indexes the reports look like they want — user, timestamp, action,
 * branch — was measured at +75% storage and +40% write time to answer questions that are asked
 * a few times a year and can afford a scan. An append-only table is mostly writes; every index
 * is a tax on all of them.
 *
 * **`action` and `table_name` are `varchar`, not `mysqlEnum`, deliberately.** The closed list is
 * real and is enforced in TypeScript (see `AUDIT.md`), but enforcing it in the column too costs
 * a migration every time a table joins the list, saves 5MB a year, and is the single most
 * divergent piece of DDL across MySQL, Postgres and SQLite (CLAUDE.md §10). Measured: identical
 * read times, 36 bytes a row.
 *
 * **No `secureFields`, for the reason `patient_access_log` has none.** Rows are inserted and
 * then only ever read. An audit record that can be amended or quietly soft-deleted is not an
 * audit record. Pruning, when it is wanted, is a delete by `id` range and touches nothing else.
 *
 * Non-goal: reads. Who *looked* at a patient is `patient_access_log`, which is a different
 * question with a different volume and its own table.
 */
export const auditLog = mysqlTable(
	'audit_log',
	{
		id: int('id').autoincrement().primaryKey(),
		userId: varchar('user_id', { length: 255 }).references(() => user.id, {
			onDelete: 'set null'
		}),
		action: varchar('action', { length: 20 }).notNull(),
		tableName: varchar('table_name', { length: 32 }).notNull(),

		/** `varchar` rather than `int`: most audited tables key on an int, but `user.id` is a UUID. */
		recordId: varchar('record_id', { length: 64 }).notNull(),

		/**
		 * What moved, as `{ field: [before, after] }` — changed fields only.
		 *
		 * Null for a create or a delete, where the row itself is the whole story and the record it
		 * points at already holds it. Secrets are never written here; `AUDIT.md` carries the
		 * redaction list, because a password hash or a payment token copied into an audit row is a
		 * second place to leak it from and one nothing is watching.
		 */
		changes: json('changes'),

		timestamp: timestamp('timestamp').defaultNow().notNull(),

		/** Text, not `varbinary` — `INET6_ATON` is MySQL-only and §10 rules it out. */
		ipAddress: varchar('ip_address', { length: 45 }),

		/**
		 * Which branch the action happened at.
		 *
		 * Not `branchRef()`: an audit row records where something *was done*, which is a fact about
		 * the event and not a default anybody should inherit. A row written before branches existed,
		 * or by a job belonging to no branch, is honestly null rather than silently attributed to
		 * the main one.
		 */
		branchId: int('branch_id')
	},
	(table) => [
		// "What happened to this record" — the only question this table is asked often.
		index('audit_log_record_idx').on(table.tableName, table.recordId, table.id)
	]
);

/** When the database was last downloaded. One row; see the note on `vat_and_withhold` for why it
 * still has a key. */
export const backup = mysqlTable('backup', {
	id: int('id').primaryKey().autoincrement(),
	lastDownload: timestamp('last_download').defaultNow().notNull()
});

// One row per execution of a scheduled job, so a cron that quietly stops firing is visible
// in the app instead of only in host logs we cannot easily read.
export const jobRun = mysqlTable(
	'job_run',
	{
		id: int('id').autoincrement().primaryKey(),
		jobName: varchar('job_name', { length: 50 }).notNull(),
		trigger: mysqlEnum('trigger_source', ['cron', 'manual', 'backstop']).notNull().default('cron'),
		status: mysqlEnum('run_status', ['running', 'success', 'failed']).notNull().default('running'),
		startedAt: timestamp('started_at').defaultNow().notNull(),
		finishedAt: timestamp('finished_at'),
		summary: varchar('summary', { length: 500 }),
		error: varchar('error', { length: 500 })
	},
	(table) => [index('job_name_started_idx').on(table.jobName, table.startedAt)]
);
