import { count, countDistinct, desc, eq, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { auditLog, jobRun, user } from '$lib/server/db/schema';
import type { ReportFilters } from '../filters';
import type { ReportChartData, Stat } from '../types';
import { alignMonths, countWhen, inRange, monthKeys, monthOf, n, topN } from '../scope.server';

/**
 * The trail underneath everything else: who changed what, and whether the
 * scheduled jobs that keep leave accrual moving actually ran.
 *
 * `audit_log` and `job_run` carry no soft-delete column and belong to no
 * employee or site, so the staff and commercial filters do not apply here —
 * only the date range narrows this report.
 */
export async function systemStats(
	filters: ReportFilters
): Promise<{ stats: Stat[]; charts: ReportChartData[] }> {
	const keys = monthKeys(filters);

	const [[audit], [jobs], byAction, byTable, byUser, byMonth, jobsByName] = await Promise.all([
		db
			.select({ total: count(), users: countDistinct(auditLog.userId) })
			.from(auditLog)
			.where(inRange(auditLog.timestamp, filters)),

		db
			.select({
				total: count(),
				failed: countWhen(sql`${jobRun.status} = 'failed'`),
				succeeded: countWhen(sql`${jobRun.status} = 'success'`),
				running: countWhen(sql`${jobRun.status} = 'running'`)
			})
			.from(jobRun)
			.where(inRange(jobRun.startedAt, filters)),

		db
			.select({ label: auditLog.action, value: count() })
			.from(auditLog)
			.where(inRange(auditLog.timestamp, filters))
			.groupBy(auditLog.action),

		db
			.select({ label: auditLog.tableName, value: count() })
			.from(auditLog)
			.where(inRange(auditLog.timestamp, filters))
			.groupBy(auditLog.tableName)
			.orderBy(desc(count()))
			.limit(14),

		db
			.select({ label: user.name, value: count() })
			.from(auditLog)
			.leftJoin(user, eq(auditLog.userId, user.id))
			.where(inRange(auditLog.timestamp, filters))
			.groupBy(user.name)
			.orderBy(desc(count()))
			.limit(12),

		db
			.select({ bucket: monthOf(auditLog.timestamp), value: count() })
			.from(auditLog)
			.where(inRange(auditLog.timestamp, filters))
			.groupBy(sql`1`),

		db
			.select({
				label: jobRun.jobName,
				succeeded: countWhen(sql`${jobRun.status} = 'success'`),
				failed: countWhen(sql`${jobRun.status} = 'failed'`)
			})
			.from(jobRun)
			.where(inRange(jobRun.startedAt, filters))
			.groupBy(jobRun.jobName)
	]);

	const stats: Stat[] = [
		{
			key: 'audit-entries',
			label: 'Recorded Changes',
			value: n(audit?.total),
			format: 'count',
			group: 'System',
			hint: `By ${n(audit?.users)} users`,
			section: 'audit-log',
			tone: 'neutral'
		},
		{
			key: 'audit-users',
			label: 'Active Users',
			value: n(audit?.users),
			format: 'count',
			group: 'System',
			hint: 'Made at least one recorded change',
			section: 'audit-log',
			tone: 'neutral'
		},
		{
			key: 'job-runs',
			label: 'Scheduled Jobs',
			value: n(jobs?.total),
			format: 'count',
			group: 'System',
			hint: `${n(jobs?.succeeded)} succeeded · ${n(jobs?.running)} still running`,
			tone: 'neutral'
		},
		{
			key: 'job-failures',
			label: 'Job Failures',
			value: n(jobs?.failed),
			format: 'count',
			group: 'System',
			hint: n(jobs?.failed) > 0 ? 'Leave accrual may be behind' : 'Everything ran clean',
			tone: n(jobs?.failed) > 0 ? 'negative' : 'positive'
		}
	];

	const charts: ReportChartData[] = [
		{
			key: 'audit-month',
			title: 'System Activity per Month',
			group: 'System',
			kind: 'line',
			labels: keys,
			wide: true,
			series: [{ label: 'Changes', data: alignMonths(keys, byMonth, (row) => n(row.value)) }]
		},
		{
			key: 'audit-action',
			title: 'Changes by Action',
			group: 'System',
			kind: 'doughnut',
			labels: topN(byAction.map(toBreakdown)).map((row) => row.label),
			series: [{ label: 'Changes', data: topN(byAction.map(toBreakdown)).map((row) => row.value) }]
		},
		{
			key: 'audit-table',
			title: 'Most Edited Tables',
			group: 'System',
			kind: 'bar',
			labels: byTable.map((row) => row.label ?? 'Unknown'),
			series: [{ label: 'Changes', data: byTable.map((row) => n(row.value)) }]
		},
		{
			key: 'audit-user',
			title: 'Busiest Users',
			group: 'System',
			kind: 'bar',
			labels: byUser.map((row) => row.label ?? 'System'),
			series: [{ label: 'Changes', data: byUser.map((row) => n(row.value)) }]
		},
		{
			key: 'job-outcomes',
			title: 'Scheduled Job Outcomes',
			description: 'A job that stops appearing here has stopped firing.',
			group: 'System',
			kind: 'bar',
			stacked: true,
			labels: jobsByName.map((row) => row.label ?? 'Unknown'),
			series: [
				{ label: 'Succeeded', data: jobsByName.map((row) => n(row.succeeded)) },
				{ label: 'Failed', data: jobsByName.map((row) => n(row.failed)) }
			]
		}
	];

	return { stats, charts };
}

function toBreakdown(row: { label: string | null; value: string | number }) {
	return { label: row.label, value: n(row.value) };
}
