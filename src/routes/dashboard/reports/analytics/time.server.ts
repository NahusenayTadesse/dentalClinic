import { count, countDistinct, eq, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { employee, employeeLeaveGrant, leave, leaveType } from '$lib/server/db/schema';
import { register } from '$lib/server/attendance';
import { hoursAndMinutes } from '$lib/attendance';
import { notDeleted } from '$lib/server/softDelete';
import type { ReportFilters } from '../filters';
import type { ReportChartData, Stat } from '../types';
import {
	alignMonths,
	all,
	countWhen,
	inRange,
	monthKeys,
	monthOf,
	n,
	staffScope,
	topN,
	total
} from '../scope.server';

/**
 * The time employees did not work: absence, leave requested, and the annual
 * leave they have banked, spent or let expire.
 *
 * Absence is the attendance register's (`server/attendance.ts`): a scheduled working day with
 * nothing recorded, decided by the same rule payroll deducts by. It was a count of `missing_days`
 * rows, typed in one by one, with an approval and a "deductable" flag payroll never read.
 */
export async function timeStats(
	filters: ReportFilters
): Promise<{ stats: Stat[]; charts: ReportChartData[] }> {
	const scope = staffScope(filters);
	const keys = monthKeys(filters);

	const leaveWhere = all([
		notDeleted(leave),
		notDeleted(employee),
		inRange(leave.startDate, filters),
		filters.leaveTypeId ? eq(leave.leaveTypeId, filters.leaveTypeId) : undefined,
		filters.approvalStatus ? sql`${leave.status} = ${filters.approvalStatus}` : undefined,
		...scope
	]);

	// The stored duration, because it is the only figure that accounts for half days — the
	// calendar span between the dates would round every half back up to a whole.
	const leaveDays = sql<string>`COALESCE(SUM(${leave.days}), 0)`;

	/*
	 * The register for everyone the report's scope covers. Decided in memory: a year of a clinic's
	 * staff is tens of thousands of days, each a few comparisons.
	 */
	const people = await db
		.select({ id: employee.id })
		.from(employee)
		.where(all([notDeleted(employee), ...scope]));
	const days = await register(filters.dateStart, filters.dateEnd, {
		staffIds: people.map((p) => p.id)
	});
	const flat = days.flatMap((row) => Object.entries(row.days).map(([day, d]) => ({ row, day, d })));
	const absences = flat.filter((x) => x.d.kind === 'absent');
	const excused = flat.filter((x) => x.d.kind === 'excused').length;
	const lateDays = flat.filter((x) => x.d.late > 0);
	const lateMinutes = lateDays.reduce((sum, x) => sum + x.d.late, 0);
	const tally = (items: typeof flat, label: (x: (typeof flat)[number]) => string) => {
		const counts = new Map<string, number>();
		for (const x of items) counts.set(label(x), (counts.get(label(x)) ?? 0) + 1);
		return [...counts].map(([key, value]) => ({ label: key, value }));
	};
	const attendanceByMonth = tally(absences, (x) => x.day.slice(0, 7)).map((r) => ({
		bucket: r.label,
		value: r.value,
		late: lateDays.filter((x) => x.day.startsWith(r.label)).length
	}));
	for (const month of new Set(lateDays.map((x) => x.day.slice(0, 7)))) {
		if (!attendanceByMonth.some((r) => r.bucket === month)) {
			attendanceByMonth.push({
				bucket: month,
				value: 0,
				late: lateDays.filter((x) => x.day.startsWith(month)).length
			});
		}
	}
	const attendanceByDepartment = tally(absences, (x) => x.row.department ?? 'No department');
	const absenceLeaders = tally(absences, (x) => x.row.name)
		.sort((a, b) => b.value - a.value)
		.slice(0, 12);

	const [[leaveTotals], [grantTotals], leaveByMonth, leaveByType, leaveByStatus] =
		await Promise.all([
			db
				.select({
					total: count(),
					days: leaveDays,
					staff: countDistinct(leave.staffId),
					approved: countWhen(sql`${leave.status} = 'approved'`),
					pending: countWhen(sql`${leave.status} = 'pending'`),
					rejected: countWhen(sql`${leave.status} = 'rejected'`)
				})
				.from(leave)
				.innerJoin(employee, eq(leave.staffId, employee.id))
				.where(leaveWhere),

			db
				.select({
					grants: count(),
					granted: total(employeeLeaveGrant.daysGranted),
					used: total(employeeLeaveGrant.daysUsed),
					expired: countWhen(sql`${employeeLeaveGrant.status} = 'expired'`),
					expiredDays: sql<string>`COALESCE(SUM(CASE WHEN ${employeeLeaveGrant.status} = 'expired'
					THEN ${employeeLeaveGrant.daysGranted} - ${employeeLeaveGrant.daysUsed} ELSE 0 END), 0)`
				})
				.from(employeeLeaveGrant)
				.innerJoin(employee, eq(employeeLeaveGrant.staffId, employee.id))
				.where(
					all([
						notDeleted(employeeLeaveGrant),
						notDeleted(employee),
						inRange(employeeLeaveGrant.grantDate, filters),
						...scope
					])
				),

			db
				.select({ bucket: monthOf(leave.startDate), value: leaveDays, requests: count() })
				.from(leave)
				.innerJoin(employee, eq(leave.staffId, employee.id))
				.where(leaveWhere)
				.groupBy(sql`1`),

			db
				.select({ label: leaveType.name, value: leaveDays })
				.from(leave)
				.innerJoin(employee, eq(leave.staffId, employee.id))
				.leftJoin(leaveType, eq(leave.leaveTypeId, leaveType.id))
				.where(leaveWhere)
				.groupBy(leaveType.name),

			db
				.select({ label: sql<string>`${leave.status}`, value: count() })
				.from(leave)
				.innerJoin(employee, eq(leave.staffId, employee.id))
				.where(leaveWhere)
				.groupBy(leave.status)
		]);

	const stats: Stat[] = [
		{
			key: 'absences',
			label: 'Days Absent',
			value: absences.length,
			format: 'days',
			group: 'Time & Leave',
			hint: `${new Set(absences.map((x) => x.row.id)).size} employees · ${excused} more excused`,
			section: 'attendance',
			tone: 'warning'
		},
		{
			key: 'attendance-late',
			label: 'Late Arrivals',
			value: lateDays.length,
			format: 'count',
			group: 'Time & Leave',
			hint: `${hoursAndMinutes(lateMinutes)} late in all — shown, not deducted`,
			section: 'attendance',
			tone: lateDays.length ? 'warning' : 'neutral'
		},
		{
			key: 'leave-requests',
			label: 'Leave Requests',
			value: n(leaveTotals?.total),
			format: 'count',
			group: 'Time & Leave',
			hint: `${n(leaveTotals?.approved)} approved · ${n(leaveTotals?.pending)} pending`,
			section: 'leaves',
			tone: 'neutral'
		},
		{
			key: 'leave-days',
			label: 'Leave Days Taken',
			value: n(leaveTotals?.days),
			format: 'days',
			group: 'Time & Leave',
			hint: `By ${n(leaveTotals?.staff)} employees`,
			section: 'leaves',
			tone: 'neutral'
		},
		{
			key: 'leave-granted',
			label: 'Leave Days Granted',
			value: n(grantTotals?.granted),
			format: 'days',
			group: 'Time & Leave',
			hint: `${n(grantTotals?.used)} of them already spent`,
			section: 'leave-grants',
			tone: 'positive'
		},
		{
			key: 'leave-expired',
			label: 'Leave Days Expired',
			value: n(grantTotals?.expiredDays),
			format: 'days',
			group: 'Time & Leave',
			hint: `Across ${n(grantTotals?.expired)} expired grants`,
			section: 'leave-grants',
			tone: 'negative'
		}
	];

	const charts: ReportChartData[] = [
		{
			key: 'absence-over-time',
			title: 'Absence per Month',
			description: 'Working days with nothing on the register, and late arrivals.',
			group: 'Time & Leave',
			kind: 'bar',
			labels: keys,
			wide: true,
			series: [
				{ label: 'Days absent', data: alignMonths(keys, attendanceByMonth, (row) => n(row.value)) },
				{
					label: 'Late arrivals',
					data: alignMonths(keys, attendanceByMonth, (row) => n(row.late))
				}
			]
		},
		{
			key: 'absence-by-department',
			title: 'Absence by Department',
			group: 'Time & Leave',
			kind: 'bar',
			labels: topN(attendanceByDepartment.map(toBreakdown), 12).map((row) => row.label),
			series: [
				{
					label: 'Days absent',
					data: topN(attendanceByDepartment.map(toBreakdown), 12).map((row) => row.value)
				}
			]
		},
		{
			key: 'absence-leaders',
			title: 'Most Days Missed',
			group: 'Time & Leave',
			kind: 'bar',
			labels: absenceLeaders.map((row) => row.label ?? 'Unknown'),
			series: [{ label: 'Days absent', data: absenceLeaders.map((row) => n(row.value)) }]
		},
		{
			key: 'leave-days-month',
			title: 'Leave Days per Month',
			group: 'Time & Leave',
			kind: 'line',
			labels: keys,
			series: [
				{ label: 'Days', data: alignMonths(keys, leaveByMonth, (row) => n(row.value)) },
				{ label: 'Requests', data: alignMonths(keys, leaveByMonth, (row) => n(row.requests)) }
			]
		},
		{
			key: 'leave-by-type',
			title: 'Leave Days by Type',
			group: 'Time & Leave',
			kind: 'doughnut',
			labels: topN(leaveByType.map(toBreakdown)).map((row) => row.label),
			series: [{ label: 'Days', data: topN(leaveByType.map(toBreakdown)).map((row) => row.value) }]
		},
		{
			key: 'leave-by-status',
			title: 'Leave Request Outcomes',
			group: 'Time & Leave',
			kind: 'doughnut',
			labels: topN(leaveByStatus.map(toBreakdown)).map((row) => row.label),
			series: [
				{ label: 'Requests', data: topN(leaveByStatus.map(toBreakdown)).map((row) => row.value) }
			]
		}
	];

	return { stats, charts };
}

function toBreakdown(row: { label: string | null; value: string | number }) {
	return { label: row.label, value: n(row.value) };
}
