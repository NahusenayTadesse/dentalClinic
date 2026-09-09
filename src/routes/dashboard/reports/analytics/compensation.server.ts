import { count, countDistinct, desc, eq, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import {
	bonuses,
	commission,
	deductions,
	employee,
	overTime,
	overTimeType
} from '$lib/server/db/schema';
import { notDeleted } from '$lib/server/softDelete';
import type { ReportFilters } from '../filters';
import type { ReportChartData, Stat } from '../types';
import {
	alignMonths,
	all,
	amountScope,
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
 * Everything paid to staff outside the base salary: bonuses, overtime,
 * commission and the deductions taken back off them.
 *
 * Absence and leave are their own report — see `time.server.ts` — so that
 * neither page pays for the other's queries.
 */
export async function compensationStats(
	filters: ReportFilters
): Promise<{ stats: Stat[]; charts: ReportChartData[] }> {
	const scope = staffScope(filters);
	const keys = monthKeys(filters);

	const bonusWhere = all([
		notDeleted(bonuses),
		notDeleted(employee),
		inRange(bonuses.bonusDate, filters),
		...amountScope(bonuses.amount, filters),
		...scope
	]);

	const overtimeWhere = all([
		notDeleted(overTime),
		notDeleted(employee),
		inRange(overTime.date, filters),
		filters.overtimeTypeId ? eq(overTime.overTimeTypeId, filters.overtimeTypeId) : undefined,
		...amountScope(overTime.total, filters),
		...scope
	]);

	const commissionWhere = all([
		notDeleted(commission),
		notDeleted(employee),
		inRange(commission.commissionDate, filters),
		...amountScope(commission.amount, filters),
		...scope
	]);

	const deductionWhere = all([
		notDeleted(deductions),
		notDeleted(employee),
		inRange(deductions.deductionDate, filters),
		...amountScope(deductions.amount, filters),
		...scope
	]);

	const [
		[bonusTotals],
		[overtimeTotals],
		[commissionTotals],
		[deductionTotals],
		bonusByMonth,
		overtimeByMonth,
		commissionByMonth,
		deductionByMonth,
		overtimeByType,
		deductionByType,
		bonusLeaders,
		overtimeLeaders
	] = await Promise.all([
		db
			.select({
				total: count(),
				amount: total(bonuses.amount),
				staff: countDistinct(bonuses.staffId)
			})
			.from(bonuses)
			.innerJoin(employee, eq(bonuses.staffId, employee.id))
			.where(bonusWhere),

		db
			.select({
				total: count(),
				amount: total(overTime.total),
				hours: total(overTime.hours),
				staff: countDistinct(overTime.staffId)
			})
			.from(overTime)
			.innerJoin(employee, eq(overTime.staffId, employee.id))
			.where(overtimeWhere),

		db
			.select({
				total: count(),
				amount: total(commission.amount),
				staff: countDistinct(commission.staffId)
			})
			.from(commission)
			.innerJoin(employee, eq(commission.staffId, employee.id))
			.where(commissionWhere),

		db
			.select({
				total: count(),
				amount: total(deductions.amount),
				staff: countDistinct(deductions.staffId),
				warnings: countWhen(sql`${deductions.warningType} IS NOT NULL`)
			})
			.from(deductions)
			.innerJoin(employee, eq(deductions.staffId, employee.id))
			.where(deductionWhere),

		db
			.select({ bucket: monthOf(bonuses.bonusDate), value: total(bonuses.amount) })
			.from(bonuses)
			.innerJoin(employee, eq(bonuses.staffId, employee.id))
			.where(bonusWhere)
			.groupBy(sql`1`),

		db
			.select({
				bucket: monthOf(overTime.date),
				value: total(overTime.total),
				hours: total(overTime.hours)
			})
			.from(overTime)
			.innerJoin(employee, eq(overTime.staffId, employee.id))
			.where(overtimeWhere)
			.groupBy(sql`1`),

		db
			.select({ bucket: monthOf(commission.commissionDate), value: total(commission.amount) })
			.from(commission)
			.innerJoin(employee, eq(commission.staffId, employee.id))
			.where(commissionWhere)
			.groupBy(sql`1`),

		db
			.select({ bucket: monthOf(deductions.deductionDate), value: total(deductions.amount) })
			.from(deductions)
			.innerJoin(employee, eq(deductions.staffId, employee.id))
			.where(deductionWhere)
			.groupBy(sql`1`),

		db
			.select({
				label: overTimeType.name,
				value: total(overTime.total),
				hours: total(overTime.hours)
			})
			.from(overTime)
			.innerJoin(employee, eq(overTime.staffId, employee.id))
			.leftJoin(overTimeType, eq(overTime.overTimeTypeId, overTimeType.id))
			.where(overtimeWhere)
			.groupBy(overTimeType.name),

		db
			.select({ label: deductions.type, value: total(deductions.amount) })
			.from(deductions)
			.innerJoin(employee, eq(deductions.staffId, employee.id))
			.where(deductionWhere)
			.groupBy(deductions.type),

		db
			.select({ label: staffName, value: total(bonuses.amount) })
			.from(bonuses)
			.innerJoin(employee, eq(bonuses.staffId, employee.id))
			.where(bonusWhere)
			.groupBy(employee.id)
			.orderBy(desc(total(bonuses.amount)))
			.limit(12),

		db
			.select({ label: staffName, value: total(overTime.hours) })
			.from(overTime)
			.innerJoin(employee, eq(overTime.staffId, employee.id))
			.where(overtimeWhere)
			.groupBy(employee.id)
			.orderBy(desc(total(overTime.hours)))
			.limit(12)
	]);

	const stats: Stat[] = [
		{
			key: 'bonuses',
			label: 'Bonuses Paid',
			value: n(bonusTotals?.amount),
			format: 'money',
			group: 'Compensation',
			hint: `${n(bonusTotals?.total)} bonuses to ${n(bonusTotals?.staff)} people`,
			section: 'bonuses',
			tone: 'negative'
		},
		{
			key: 'overtime-amount',
			label: 'Overtime Cost',
			value: n(overtimeTotals?.amount),
			format: 'money',
			group: 'Compensation',
			hint: `${n(overtimeTotals?.total)} entries logged`,
			section: 'overtime',
			tone: 'negative'
		},
		{
			key: 'overtime-hours',
			label: 'Overtime Hours',
			value: n(overtimeTotals?.hours),
			format: 'hours',
			group: 'Compensation',
			hint: `Worked by ${n(overtimeTotals?.staff)} employees`,
			section: 'overtime',
			tone: 'warning'
		},
		{
			key: 'commissions',
			label: 'Commission Paid',
			value: n(commissionTotals?.amount),
			format: 'money',
			group: 'Compensation',
			hint: `${n(commissionTotals?.total)} entries`,
			section: 'commissions',
			tone: 'negative'
		},
		{
			key: 'deductions',
			label: 'Deductions',
			value: n(deductionTotals?.amount),
			format: 'money',
			group: 'Compensation',
			hint: `${n(deductionTotals?.total)} entries · ${n(deductionTotals?.warnings)} with a warning`,
			section: 'deductions',
			tone: 'warning'
		}
	];

	const charts: ReportChartData[] = [
		{
			key: 'extras-over-time',
			title: 'Pay on Top of Salary',
			description: 'Bonuses, overtime and commission month by month.',
			group: 'Compensation',
			kind: 'bar',
			labels: keys,
			money: true,
			stacked: true,
			wide: true,
			series: [
				{ label: 'Bonuses', data: alignMonths(keys, bonusByMonth, (row) => n(row.value)) },
				{ label: 'Overtime', data: alignMonths(keys, overtimeByMonth, (row) => n(row.value)) },
				{ label: 'Commission', data: alignMonths(keys, commissionByMonth, (row) => n(row.value)) },
				{
					label: 'Deductions',
					data: alignMonths(keys, deductionByMonth, (row) => -n(row.value))
				}
			]
		},
		{
			key: 'overtime-hours-month',
			title: 'Overtime Hours per Month',
			group: 'Compensation',
			kind: 'line',
			labels: keys,
			series: [{ label: 'Hours', data: alignMonths(keys, overtimeByMonth, (row) => n(row.hours)) }]
		},
		{
			key: 'overtime-by-type',
			title: 'Overtime by Type',
			group: 'Compensation',
			kind: 'doughnut',
			money: true,
			labels: topN(overtimeByType.map(toBreakdown)).map((row) => row.label),
			series: [
				{ label: 'Cost', data: topN(overtimeByType.map(toBreakdown)).map((row) => row.value) }
			]
		},
		{
			key: 'deductions-by-type',
			title: 'Deductions by Type',
			group: 'Compensation',
			kind: 'bar',
			money: true,
			labels: topN(deductionByType.map(toBreakdown), 10).map((row) => row.label),
			series: [
				{
					label: 'Amount',
					data: topN(deductionByType.map(toBreakdown), 10).map((row) => row.value)
				}
			]
		},
		{
			key: 'bonus-leaders',
			title: 'Most Bonused Employees',
			group: 'Compensation',
			kind: 'bar',
			money: true,
			labels: bonusLeaders.map((row) => row.label ?? 'Unknown'),
			series: [{ label: 'Bonuses', data: bonusLeaders.map((row) => n(row.value)) }]
		},
		{
			key: 'overtime-leaders',
			title: 'Most Overtime Worked',
			group: 'Compensation',
			kind: 'bar',
			labels: overtimeLeaders.map((row) => row.label ?? 'Unknown'),
			series: [{ label: 'Hours', data: overtimeLeaders.map((row) => n(row.value)) }]
		}
	];

	return { stats, charts };
}

function toBreakdown(row: { label: string | null; value: string | number }) {
	return { label: row.label, value: n(row.value) };
}
