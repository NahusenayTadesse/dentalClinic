// misc.ts - Handles miscellaneous items like positions and audit logs
import {
	mysqlTable,
	mysqlEnum,
	varchar,
	timestamp,
	int,
	json,
	date,
	decimal,
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
	ipAddress: varchar('ip_address', { length: 45 })
});

export const backup = mysqlTable('backup', {
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

export const reports = mysqlTable('reports', {
	id: int('id').autoincrement().primaryKey(),
	reportDate: date('report_date').notNull().unique(),
	bookedAppointments: int('booked_appointments').default(0),
	cancelledAppointments: int('cancelled_appointments').default(0),
	productsSold: int('products_sold').notNull().default(0),
	servicesRendered: int('services_rendered').notNull(),
	dailyExpenses: decimal('daily_expenses', { precision: 10, scale: 2 }),
	dailyIncome: decimal('daily_income', { precision: 10, scale: 2 }),
	transactions: int('transactions').notNull(),
	staffPaid: int('staff_paid'),
	totalStaffPaid: decimal('total_staff_paid', { precision: 10, scale: 2 }),
	staffHired: int('staff_hired'),
	staffFired: int('staff_fired')
});
