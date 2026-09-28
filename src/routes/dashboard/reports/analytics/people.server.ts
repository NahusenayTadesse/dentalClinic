import { count, eq, isNull, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import {
	department,
	educationalLevel,
	employee,
	employeeTermination,
	employmentStatuses,
	position,
	branch
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
	staffScope,
	topN
} from '../scope.server';
import { daysBetween, today } from '$lib/server/db/dialect';

/**
 * Who the company employs, who joined, and who left.
 *
 * "Current" here means an employee with no termination date, not one whose
 * `isActive` flag is set: that flag is overloaded across the app, while a
 * termination date is only ever written when someone actually leaves.
 */
export async function peopleStats(
	filters: ReportFilters
): Promise<{ stats: Stat[]; charts: ReportChartData[] }> {
	const scope = staffScope(filters);
	const current = all([notDeleted(employee), isNull(employee.terminationDate), ...scope]);
	const keys = monthKeys(filters);

	const [
		[headcount],
		[hired],
		[terminated],
		byDepartment,
		byGender,
		byStatus,
		byBranch,
		byEducation,
		byMarital,
		byPosition,
		byAge,
		byTenure,
		hiresByMonth,
		terminationsByMonth
	] = await Promise.all([
		db
			.select({
				total: count(),
				male: countWhen(sql`${employee.gender} = 'male'`),
				female: countWhen(sql`${employee.gender} = 'female'`),
				// DATEDIFF/365.25 is close enough for an average that is only ever
				// read to one decimal place, and it costs no date arithmetic in JS.
				avgTenure: sql<string>`COALESCE(AVG(${daysBetween(today(), employee.hireDate)} / 365.25), 0)`,
				avgAge: sql<string>`COALESCE(AVG(${daysBetween(today(), employee.birthDate)} / 365.25), 0)`,
				leaveBalance: sql<string>`COALESCE(SUM(${employee.leavesLeft}), 0)`
			})
			.from(employee)
			.where(current),

		db
			.select({ total: count() })
			.from(employee)
			.where(all([notDeleted(employee), inRange(employee.hireDate, filters), ...scope])),

		db
			.select({ total: count() })
			.from(employeeTermination)
			.innerJoin(employee, eq(employeeTermination.staffId, employee.id))
			.where(
				all([
					notDeleted(employeeTermination),
					notDeleted(employee),
					inRange(employeeTermination.terminationDate, filters),
					...scope
				])
			),

		db
			.select({ label: department.name, value: count() })
			.from(employee)
			.leftJoin(department, eq(employee.departmentId, department.id))
			.where(current)
			.groupBy(department.name),

		db
			.select({ label: sql<string>`${employee.gender}`, value: count() })
			.from(employee)
			.where(current)
			.groupBy(employee.gender),

		db
			.select({ label: employmentStatuses.name, value: count() })
			.from(employee)
			.leftJoin(employmentStatuses, eq(employee.employmentStatus, employmentStatuses.id))
			.where(current)
			.groupBy(employmentStatuses.name),

		db
			.select({ label: branch.name, value: count() })
			.from(employee)
			.leftJoin(branch, eq(employee.branchId, branch.id))
			.where(current)
			.groupBy(branch.name),

		db
			.select({ label: educationalLevel.name, value: count() })
			.from(employee)
			.leftJoin(educationalLevel, eq(employee.educationalLevel, educationalLevel.id))
			.where(current)
			.groupBy(educationalLevel.name),

		db
			.select({ label: sql<string>`${employee.martialStatus}`, value: count() })
			.from(employee)
			.where(current)
			.groupBy(employee.martialStatus),

		db
			.select({ label: position.name, value: count() })
			.from(employee)
			.leftJoin(position, eq(employee.positionId, position.id))
			.where(current)
			.groupBy(position.name),

		db
			.select({
				label: sql<string>`CASE
					WHEN ${daysBetween(today(), employee.birthDate)} / 365.25 < 25 THEN 'Under 25'
					WHEN ${daysBetween(today(), employee.birthDate)} / 365.25 < 35 THEN '25 - 34'
					WHEN ${daysBetween(today(), employee.birthDate)} / 365.25 < 45 THEN '35 - 44'
					WHEN ${daysBetween(today(), employee.birthDate)} / 365.25 < 55 THEN '45 - 54'
					ELSE '55 and over'
				END`,
				value: count()
			})
			.from(employee)
			.where(current)
			.groupBy(sql`1`),

		db
			.select({
				label: sql<string>`CASE
					WHEN ${daysBetween(today(), employee.hireDate)} / 365.25 < 1 THEN 'Under 1 year'
					WHEN ${daysBetween(today(), employee.hireDate)} / 365.25 < 3 THEN '1 - 2 years'
					WHEN ${daysBetween(today(), employee.hireDate)} / 365.25 < 5 THEN '3 - 4 years'
					WHEN ${daysBetween(today(), employee.hireDate)} / 365.25 < 10 THEN '5 - 9 years'
					ELSE '10 years and over'
				END`,
				value: count()
			})
			.from(employee)
			.where(current)
			.groupBy(sql`1`),

		db
			.select({ bucket: monthOf(employee.hireDate), value: count() })
			.from(employee)
			.where(all([notDeleted(employee), inRange(employee.hireDate, filters), ...scope]))
			.groupBy(sql`1`),

		db
			.select({ bucket: monthOf(employeeTermination.terminationDate), value: count() })
			.from(employeeTermination)
			.innerJoin(employee, eq(employeeTermination.staffId, employee.id))
			.where(
				all([
					notDeleted(employeeTermination),
					notDeleted(employee),
					inRange(employeeTermination.terminationDate, filters),
					...scope
				])
			)
			.groupBy(sql`1`)
	]);

	const hires = alignMonths(keys, hiresByMonth, (row) => n(row.value));
	const exits = alignMonths(keys, terminationsByMonth, (row) => n(row.value));

	const stats: Stat[] = [
		{
			key: 'headcount',
			label: 'Employees',
			value: n(headcount?.total),
			format: 'count',
			group: 'People',
			hint: 'On the books today',
			section: 'employees',
			tone: 'neutral'
		},
		{
			key: 'hired',
			label: 'Hired',
			value: n(hired?.total),
			format: 'count',
			group: 'People',
			hint: 'Joined inside the range',
			section: 'hires',
			tone: 'positive'
		},
		{
			key: 'terminated',
			label: 'Terminated',
			value: n(terminated?.total),
			format: 'count',
			group: 'People',
			hint: 'Left inside the range',
			section: 'terminations',
			tone: 'negative'
		},
		{
			key: 'net-headcount',
			label: 'Net Change',
			value: n(hired?.total) - n(terminated?.total),
			format: 'count',
			group: 'People',
			hint: 'Hires less terminations',
			tone: n(hired?.total) >= n(terminated?.total) ? 'positive' : 'negative'
		},
		{
			key: 'turnover',
			label: 'Turnover',
			value: n(headcount?.total) ? (n(terminated?.total) / n(headcount?.total)) * 100 : 0,
			format: 'percent',
			group: 'People',
			hint: 'Terminations against current headcount',
			tone: 'warning'
		},
		{
			key: 'women',
			label: 'Women',
			value: n(headcount?.total) ? (n(headcount?.female) / n(headcount?.total)) * 100 : 0,
			format: 'percent',
			group: 'People',
			hint: `${n(headcount?.female)} of ${n(headcount?.total)} employees`,
			tone: 'neutral'
		},
		{
			key: 'avg-tenure',
			label: 'Average Tenure',
			value: n(headcount?.avgTenure),
			format: 'years',
			group: 'People',
			hint: 'Time served by current staff',
			tone: 'neutral'
		},
		{
			key: 'avg-age',
			label: 'Average Age',
			value: n(headcount?.avgAge),
			format: 'years',
			group: 'People',
			hint: 'Across current staff',
			tone: 'neutral'
		},
		{
			key: 'leave-balance',
			label: 'Leave Owed',
			value: n(headcount?.leaveBalance),
			format: 'days',
			group: 'People',
			hint: 'Unused days sitting on the books',
			section: 'leave-grants',
			tone: 'warning'
		}
	];

	const charts: ReportChartData[] = [
		{
			key: 'headcount-movement',
			title: 'Hires and Terminations',
			description: 'Who joined and who left, month by month.',
			group: 'People',
			kind: 'bar',
			labels: keys,
			series: [
				{ label: 'Hired', data: hires },
				{ label: 'Terminated', data: exits.map((value) => -value) },
				{ label: 'Net', data: hires.map((value, index) => value - exits[index]), type: 'line' }
			],
			wide: true
		},
		{
			key: 'staff-by-department',
			title: 'Headcount by Department',
			group: 'People',
			kind: 'doughnut',
			labels: topN(byDepartment).map((row) => row.label),
			series: [{ label: 'Employees', data: topN(byDepartment).map((row) => row.value) }]
		},
		{
			key: 'staff-by-branch',
			title: 'Headcount by Branch',
			group: 'People',
			kind: 'bar',
			labels: topN(byBranch, 12).map((row) => row.label),
			series: [{ label: 'Employees', data: topN(byBranch, 12).map((row) => row.value) }]
		},
		{
			key: 'staff-by-status',
			title: 'Employment Status',
			group: 'People',
			kind: 'doughnut',
			labels: topN(byStatus).map((row) => row.label),
			series: [{ label: 'Employees', data: topN(byStatus).map((row) => row.value) }]
		},
		{
			key: 'staff-by-position',
			title: 'Headcount by Position',
			group: 'People',
			kind: 'bar',
			labels: topN(byPosition, 12).map((row) => row.label),
			series: [{ label: 'Employees', data: topN(byPosition, 12).map((row) => row.value) }]
		},
		{
			key: 'staff-by-gender',
			title: 'Gender Split',
			group: 'People',
			kind: 'doughnut',
			labels: topN(byGender).map((row) => row.label),
			series: [{ label: 'Employees', data: topN(byGender).map((row) => row.value) }]
		},
		{
			key: 'staff-by-education',
			title: 'Educational Level',
			group: 'People',
			kind: 'bar',
			labels: topN(byEducation, 10).map((row) => row.label),
			series: [{ label: 'Employees', data: topN(byEducation, 10).map((row) => row.value) }]
		},
		{
			key: 'staff-by-marital',
			title: 'Marital Status',
			group: 'People',
			kind: 'polarArea',
			labels: topN(byMarital).map((row) => row.label),
			series: [{ label: 'Employees', data: topN(byMarital).map((row) => row.value) }]
		},
		{
			key: 'staff-by-age',
			title: 'Age Distribution',
			group: 'People',
			kind: 'bar',
			labels: orderBrackets(byAge, AGE_ORDER).map((row) => row.label),
			series: [
				{ label: 'Employees', data: orderBrackets(byAge, AGE_ORDER).map((row) => row.value) }
			]
		},
		{
			key: 'staff-by-tenure',
			title: 'Tenure Distribution',
			group: 'People',
			kind: 'bar',
			labels: orderBrackets(byTenure, TENURE_ORDER).map((row) => row.label),
			series: [
				{ label: 'Employees', data: orderBrackets(byTenure, TENURE_ORDER).map((row) => row.value) }
			]
		}
	];

	return { stats, charts };
}

const AGE_ORDER = ['Under 25', '25 - 34', '35 - 44', '45 - 54', '55 and over'];
const TENURE_ORDER = [
	'Under 1 year',
	'1 - 2 years',
	'3 - 4 years',
	'5 - 9 years',
	'10 years and over'
];

/**
 * Buckets come back in whatever order the group by produced them. Sorting them
 * by size — what `topN` does elsewhere — would scramble an axis that only reads
 * correctly youngest-to-oldest, so these keep their declared order.
 */
function orderBrackets(
	rows: { label: string | null; value: number }[],
	order: string[]
): { label: string; value: number }[] {
	const byLabel = new Map(rows.map((row) => [row.label ?? '', n(row.value)]));
	return order.map((label) => ({ label, value: byLabel.get(label) ?? 0 }));
}
