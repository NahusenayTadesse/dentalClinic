import { count, countDistinct, desc, eq, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import {
	department,
	employee,
	employeeLeaveGrant,
	leave,
	leaveType,
	missingDays
} from '$lib/server/db/schema';
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
	staffName,
	staffScope,
	topN,
	total
} from '../scope.server';

/**
 * The time employees did not work: absence, leave requested, and the annual
 * leave they have banked, spent or let expire.
 */
export async function timeStats(
	filters: ReportFilters
): Promise<{ stats: Stat[]; charts: ReportChartData[] }> {
	const scope = staffScope(filters);
	const keys = monthKeys(filters);

	const attendanceWhere = all([
		notDeleted(missingDays),
		notDeleted(employee),
		inRange(missingDays.day, filters),
		filters.approvalStatus ? sql`${missingDays.approval} = ${filters.approvalStatus}` : undefined,
		...scope
	]);

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

	const [
		[attendanceTotals],
		[leaveTotals],
		[grantTotals],
		attendanceByMonth,
		leaveByMonth,
		leaveByType,
		leaveByStatus,
		attendanceByDepartment,
		absenceLeaders
	] = await Promise.all([
		db
			.select({
				total: count(),
				staff: countDistinct(missingDays.staffId),
				deductable: countWhen(sql`${missingDays.deductable} = true`),
				amount: total(missingDays.deductableAmount),
				approved: countWhen(sql`${missingDays.approval} = 'approved'`),
				pending: countWhen(sql`${missingDays.approval} = 'pending'`),
				rejected: countWhen(sql`${missingDays.approval} = 'rejected'`)
			})
			.from(missingDays)
			.innerJoin(employee, eq(missingDays.staffId, employee.id))
			.where(attendanceWhere),

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
			.select({
				bucket: monthOf(missingDays.day),
				value: count(),
				deductable: countWhen(sql`${missingDays.deductable} = true`)
			})
			.from(missingDays)
			.innerJoin(employee, eq(missingDays.staffId, employee.id))
			.where(attendanceWhere)
			.groupBy(sql`1`),

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
			.groupBy(leave.status),

		db
			.select({ label: department.name, value: count() })
			.from(missingDays)
			.innerJoin(employee, eq(missingDays.staffId, employee.id))
			.leftJoin(department, eq(employee.departmentId, department.id))
			.where(attendanceWhere)
			.groupBy(department.name),

		db
			.select({ label: staffName, value: count() })
			.from(missingDays)
			.innerJoin(employee, eq(missingDays.staffId, employee.id))
			.where(attendanceWhere)
			.groupBy(employee.id)
			.orderBy(desc(count()))
			.limit(12)
	]);

	const stats: Stat[] = [
		{
			key: 'absences',
			label: 'Days Absent',
			value: n(attendanceTotals?.total),
			format: 'days',
			group: 'Time & Leave',
			hint: `${n(attendanceTotals?.staff)} employees · ${n(attendanceTotals?.deductable)} deductable`,
			section: 'attendance',
			tone: 'warning'
		},
		{
			key: 'absence-cost',
			label: 'Absence Docked',
			value: n(attendanceTotals?.amount),
			format: 'money',
			group: 'Time & Leave',
			hint: 'Deductable absence, as recorded',
			section: 'attendance',
			tone: 'warning'
		},
		{
			key: 'absence-pending',
			label: 'Absences Unreviewed',
			value: n(attendanceTotals?.pending),
			format: 'count',
			group: 'Time & Leave',
			hint: `${n(attendanceTotals?.approved)} approved · ${n(attendanceTotals?.rejected)} rejected`,
			section: 'attendance',
			tone: n(attendanceTotals?.pending) > 0 ? 'warning' : 'neutral'
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
			description: 'Total days missed, and how many were deductable.',
			group: 'Time & Leave',
			kind: 'bar',
			labels: keys,
			wide: true,
			series: [
				{ label: 'Days absent', data: alignMonths(keys, attendanceByMonth, (row) => n(row.value)) },
				{
					label: 'Deductable',
					data: alignMonths(keys, attendanceByMonth, (row) => n(row.deductable))
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
