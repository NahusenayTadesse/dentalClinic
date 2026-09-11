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

export const auditLog = mysqlTable('audit_log', {
	id: int('id').autoincrement().primaryKey(),
	userId: varchar('user_id', { length: 255 }).references(() => user.id, { onDelete: 'set null' }),
	action: varchar('action', { length: 32 }).notNull(),
	tableName: varchar('table_name', { length: 32 }).notNull(),
	recordId: varchar('record_id', { length: 255 }).notNull(),
	oldValues: json('old_values'),
	newValues: json('new_values'),
	timestamp: timestamp('timestamp').defaultNow().notNull(),
	ipAddress: varchar('ip_address', { length: 45 }),

	/**
	 * Which branch the action happened at.
	 *
	 * Not `branchRef()`: an audit row records where something *was done*, which is a fact about the
	 * event and not a default anybody should inherit. A row written before branches existed, or by
	 * a job belonging to no branch, is honestly null rather than silently attributed to the main
	 * one.
	 */
	branchId: int('branch_id')
});

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
