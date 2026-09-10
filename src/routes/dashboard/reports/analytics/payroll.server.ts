import { count, countDistinct, desc, eq, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import {
	department,
	employee,
	paymentMethods,
	payrollAdjustments,
	payrollEntries,
	payrollReceipts,
	payrollRuns,
	salaries,
	branch
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
	total,
	topN
} from '../scope.server';

/** The Ethiopian months in calendar order, for sorting a period axis in SQL. */
const ETHIOPIAN_MONTHS = [
	'መስከረም',
	'ጥቅምት',
	'ህዳር',
	'ታህሳስ',
	'ጥር',
	'የካቲት',
	'መጋቢት',
	'ሚያዝያ',
	'ግንቦት',
	'ሰኔ',
	'ሐምሌ',
	'ነሐሴ'
];

/**
 * What payroll cost, and what it was made of.
 *
 * Payslips are dated by `payPeriodStart` rather than by when the row was
 * written: a run finalised late still belongs to the month it paid for, and
 * dating it by `createdAt` would drop it into the wrong bucket on every chart.
 */
export async function payrollStats(
	filters: ReportFilters
): Promise<{ stats: Stat[]; charts: ReportChartData[] }> {
	const scope = staffScope(filters);
	const keys = monthKeys(filters);

	const entryWhere = all([
		notDeleted(payrollEntries),
		notDeleted(employee),
		inRange(payrollEntries.payPeriodStart, filters),
		filters.payrollStatus ? sql`${payrollEntries.status} = ${filters.payrollStatus}` : undefined,
		filters.paymentMethodId
			? eq(payrollEntries.paymentMethodId, filters.paymentMethodId)
			: undefined,
		...amountScope(payrollEntries.netAmount, filters),
		...scope
	]);

	const [
		[totals],
		[runTotals],
		[receipts],
		[adjustments],
		[salaryChanges],
		byMonth,
		byDepartment,
		byBranch,
		byMethod,
		byStatus,
		byPeriod,
		topEarners,
		adjustmentsByMonth
	] = await Promise.all([
		db
			.select({
				payslips: count(),
				staffPaid: countDistinct(payrollEntries.staffId),
				gross: total(payrollEntries.grossAmount),
				net: total(payrollEntries.netAmount),
				basic: total(payrollEntries.basicSalary),
				overtime: total(payrollEntries.overtimeAmount),
				bonus: total(payrollEntries.bonusAmount),
				commission: total(payrollEntries.commissionAmount),
				deductions: total(payrollEntries.deductions),
				tax: total(payrollEntries.taxAmount),
				penEm: total(payrollEntries.penEm),
				penOrg: total(payrollEntries.penOrg),
				transport: total(payrollEntries.transportAllowance),
				housing: total(payrollEntries.housingAllowance),
				position: total(payrollEntries.positionAllowance),
				nonTaxable: total(payrollEntries.nonTaxableAllowance),
				allowances: total(payrollEntries.allowances),
				attendancePenalty: total(payrollEntries.attendancePenality),
				paid: total(payrollEntries.paidAmount)
			})
			.from(payrollEntries)
			.innerJoin(employee, eq(payrollEntries.staffId, employee.id))
			.where(entryWhere),

		db
			.select({
				runs: count(),
				finalized: countWhen(sql`${payrollRuns.finalized} = true`)
			})
			.from(payrollRuns)
			.where(all([notDeleted(payrollRuns), inRange(payrollRuns.createdAt, filters)])),

		db
			.select({
				payments: count(),
				amount: total(payrollReceipts.amount),
				employees: total(payrollReceipts.numberOfEmployees)
			})
			.from(payrollReceipts)
			.where(all([notDeleted(payrollReceipts), inRange(payrollReceipts.paidDate, filters)])),

		db
			.select({
				total: count(),
				bonus: sql<string>`COALESCE(SUM(CASE WHEN ${payrollAdjustments.adjustmentType} = 'bonus' THEN ${payrollAdjustments.amount} ELSE 0 END), 0)`,
				deduction: sql<string>`COALESCE(SUM(CASE WHEN ${payrollAdjustments.adjustmentType} = 'deduction' THEN ${payrollAdjustments.amount} ELSE 0 END), 0)`
			})
			.from(payrollAdjustments)
			.where(all([notDeleted(payrollAdjustments), inRange(payrollAdjustments.createdAt, filters)])),

		db
			.select({ total: count(), amount: total(salaries.amount) })
			.from(salaries)
			.innerJoin(employee, eq(salaries.staffId, employee.id))
			.where(
				all([
					notDeleted(salaries),
					notDeleted(employee),
					inRange(salaries.startDate, filters),
					...scope
				])
			),

		db
			.select({
				bucket: monthOf(payrollEntries.payPeriodStart),
				gross: total(payrollEntries.grossAmount),
				net: total(payrollEntries.netAmount),
				tax: total(payrollEntries.taxAmount),
				basic: total(payrollEntries.basicSalary),
				overtime: total(payrollEntries.overtimeAmount),
				bonus: total(payrollEntries.bonusAmount),
				commission: total(payrollEntries.commissionAmount),
				allowances: sql<string>`COALESCE(SUM(
					COALESCE(${payrollEntries.transportAllowance}, 0)
					+ COALESCE(${payrollEntries.housingAllowance}, 0)
					+ COALESCE(${payrollEntries.positionAllowance}, 0)
					+ COALESCE(${payrollEntries.nonTaxableAllowance}, 0)
				), 0)`,
				deductions: total(payrollEntries.deductions),
				pension: sql<string>`COALESCE(SUM(COALESCE(${payrollEntries.penEm}, 0) + COALESCE(${payrollEntries.penOrg}, 0)), 0)`,
				staff: countDistinct(payrollEntries.staffId)
			})
			.from(payrollEntries)
			.innerJoin(employee, eq(payrollEntries.staffId, employee.id))
			.where(entryWhere)
			.groupBy(sql`1`),

		db
			.select({ label: department.name, value: total(payrollEntries.netAmount) })
			.from(payrollEntries)
			.innerJoin(employee, eq(payrollEntries.staffId, employee.id))
			.leftJoin(department, eq(employee.departmentId, department.id))
			.where(entryWhere)
			.groupBy(department.name),

		db
			.select({ label: branch.name, value: total(payrollEntries.netAmount) })
			.from(payrollEntries)
			.innerJoin(employee, eq(payrollEntries.staffId, employee.id))
			.leftJoin(branch, eq(employee.branchId, branch.id))
			.where(entryWhere)
			.groupBy(branch.name),

		db
			.select({ label: paymentMethods.name, value: total(payrollEntries.netAmount) })
			.from(payrollEntries)
			.innerJoin(employee, eq(payrollEntries.staffId, employee.id))
			.leftJoin(paymentMethods, eq(payrollEntries.paymentMethodId, paymentMethods.id))
			.where(entryWhere)
			.groupBy(paymentMethods.name),

		db
			.select({ label: sql<string>`${payrollEntries.status}`, value: count() })
			.from(payrollEntries)
			.innerJoin(employee, eq(payrollEntries.staffId, employee.id))
			.where(entryWhere)
			.groupBy(payrollEntries.status),

		db
			.select({
				label: sql<string>`CONCAT(${payrollRuns.month}, ' ', ${payrollRuns.year})`,
				gross: total(payrollRuns.totalGross),
				net: total(payrollRuns.totalNet),
				tax: total(payrollRuns.totalTax),
				pension: sql<string>`COALESCE(SUM(COALESCE(${payrollRuns.penEm}, 0) + COALESCE(${payrollRuns.penOrg}, 0)), 0)`,
				sortYear: sql<number>`${payrollRuns.year}`,
				sortMonth: sql<number>`FIELD(${payrollRuns.month}, ${sql.join(
					ETHIOPIAN_MONTHS.map((month) => sql`${month}`),
					sql`, `
				)})`
			})
			.from(payrollRuns)
			.where(all([notDeleted(payrollRuns), inRange(payrollRuns.createdAt, filters)]))
			.groupBy(sql`1`, sql`6`, sql`7`)
			.orderBy(sql`6`, sql`7`),

		db
			.select({ label: staffName, value: total(payrollEntries.netAmount) })
			.from(payrollEntries)
			.innerJoin(employee, eq(payrollEntries.staffId, employee.id))
			.where(entryWhere)
			.groupBy(employee.id)
			.orderBy(desc(total(payrollEntries.netAmount)))
			.limit(12),

		db
			.select({
				bucket: monthOf(payrollAdjustments.createdAt),
				bonus: sql<string>`COALESCE(SUM(CASE WHEN ${payrollAdjustments.adjustmentType} = 'bonus' THEN ${payrollAdjustments.amount} ELSE 0 END), 0)`,
				deduction: sql<string>`COALESCE(SUM(CASE WHEN ${payrollAdjustments.adjustmentType} = 'deduction' THEN ${payrollAdjustments.amount} ELSE 0 END), 0)`
			})
			.from(payrollAdjustments)
			.where(all([notDeleted(payrollAdjustments), inRange(payrollAdjustments.createdAt, filters)]))
			.groupBy(sql`1`)
	]);

	const payslips = n(totals?.payslips);

	const stats: Stat[] = [
		{
			key: 'payroll-runs',
			label: 'Payroll Runs',
			value: n(runTotals?.runs),
			format: 'count',
			group: 'Payroll',
			hint: `${n(runTotals?.finalized)} finalised`,
			section: 'payroll-runs',
			tone: 'neutral'
		},
		{
			key: 'payslips',
			label: 'Payslips Issued',
			value: payslips,
			format: 'count',
			group: 'Payroll',
			hint: `${n(totals?.staffPaid)} employees paid`,
			section: 'payroll-entries',
			tone: 'neutral'
		},
		{
			key: 'payroll-gross',
			label: 'Gross Payroll',
			value: n(totals?.gross),
			format: 'money',
			group: 'Payroll',
			hint: 'Before tax and deductions',
			section: 'payroll-entries',
			tone: 'negative'
		},
		{
			key: 'payroll-net',
			label: 'Net Paid',
			value: n(totals?.net),
			format: 'money',
			group: 'Payroll',
			hint: 'What employees took home',
			section: 'payroll-entries',
			tone: 'negative'
		},
		{
			key: 'payroll-basic',
			label: 'Basic Salaries',
			value: n(totals?.basic),
			format: 'money',
			group: 'Payroll',
			hint: 'Base pay before anything else',
			tone: 'neutral'
		},
		{
			key: 'payroll-tax',
			label: 'Income Tax',
			value: n(totals?.tax),
			format: 'money',
			group: 'Payroll',
			hint: 'Withheld and remitted',
			tone: 'warning'
		},
		{
			key: 'payroll-pension',
			label: 'Pension',
			value: n(totals?.penEm) + n(totals?.penOrg),
			format: 'money',
			group: 'Payroll',
			hint: `Employee ${Math.round(n(totals?.penEm)).toLocaleString()} · Company ${Math.round(n(totals?.penOrg)).toLocaleString()}`,
			tone: 'warning'
		},
		{
			key: 'payroll-allowances',
			label: 'Allowances',
			value:
				n(totals?.transport) + n(totals?.housing) + n(totals?.position) + n(totals?.nonTaxable),
			format: 'money',
			group: 'Payroll',
			hint: 'Transport, housing, position and non-taxable',
			tone: 'neutral'
		},
		{
			key: 'payroll-overtime',
			label: 'Overtime Paid',
			value: n(totals?.overtime),
			format: 'money',
			group: 'Payroll',
			hint: 'On payslips inside the range',
			section: 'overtime',
			tone: 'negative'
		},
		{
			key: 'payroll-deductions',
			label: 'Deductions',
			value: n(totals?.deductions),
			format: 'money',
			group: 'Payroll',
			hint: 'Taken off payslips',
			section: 'deductions',
			tone: 'warning'
		},
		{
			key: 'payroll-attendance-penalty',
			label: 'Attendance Penalties',
			value: n(totals?.attendancePenalty),
			format: 'money',
			group: 'Payroll',
			hint: 'Docked for absence',
			section: 'attendance',
			tone: 'warning'
		},
		{
			key: 'payroll-average',
			label: 'Average Net Pay',
			value: payslips ? n(totals?.net) / payslips : 0,
			format: 'money',
			group: 'Payroll',
			hint: 'Per payslip issued',
			tone: 'neutral'
		},
		{
			key: 'payroll-adjustments',
			label: 'Payroll Adjustments',
			value: n(adjustments?.total),
			format: 'count',
			group: 'Payroll',
			hint: `+${Math.round(n(adjustments?.bonus)).toLocaleString()} / -${Math.round(n(adjustments?.deduction)).toLocaleString()}`,
			section: 'payroll-adjustments',
			tone: 'neutral'
		},
		{
			key: 'payroll-disbursed',
			label: 'Payroll Disbursed',
			value: n(receipts?.amount),
			format: 'money',
			group: 'Payroll',
			hint: `${n(receipts?.payments)} payment runs sent out`,
			section: 'payroll-receipts',
			tone: 'negative'
		},
		{
			key: 'salary-changes',
			label: 'Salary Changes',
			value: n(salaryChanges?.total),
			format: 'count',
			group: 'Payroll',
			hint: 'Salary records that took effect',
			section: 'salary-changes',
			tone: 'neutral'
		}
	];

	const charts: ReportChartData[] = [
		{
			key: 'payroll-cost',
			title: 'Payroll Cost Over Time',
			description: 'Gross, net and tax for every month in the range.',
			group: 'Payroll',
			kind: 'line',
			labels: keys,
			money: true,
			wide: true,
			series: [
				{ label: 'Gross', data: alignMonths(keys, byMonth, (row) => n(row.gross)) },
				{ label: 'Net', data: alignMonths(keys, byMonth, (row) => n(row.net)) },
				{ label: 'Tax', data: alignMonths(keys, byMonth, (row) => n(row.tax)) }
			]
		},
		{
			key: 'payroll-composition',
			title: 'What Payroll Is Made Of',
			description: 'Basic pay, allowances and extras stacked per month.',
			group: 'Payroll',
			kind: 'bar',
			labels: keys,
			money: true,
			stacked: true,
			wide: true,
			series: [
				{ label: 'Basic', data: alignMonths(keys, byMonth, (row) => n(row.basic)) },
				{ label: 'Allowances', data: alignMonths(keys, byMonth, (row) => n(row.allowances)) },
				{ label: 'Overtime', data: alignMonths(keys, byMonth, (row) => n(row.overtime)) },
				{ label: 'Bonus', data: alignMonths(keys, byMonth, (row) => n(row.bonus)) },
				{ label: 'Commission', data: alignMonths(keys, byMonth, (row) => n(row.commission)) }
			]
		},
		{
			key: 'payroll-statutory',
			title: 'Tax, Pension and Deductions',
			group: 'Payroll',
			kind: 'bar',
			labels: keys,
			money: true,
			stacked: true,
			series: [
				{ label: 'Tax', data: alignMonths(keys, byMonth, (row) => n(row.tax)) },
				{ label: 'Pension', data: alignMonths(keys, byMonth, (row) => n(row.pension)) },
				{ label: 'Deductions', data: alignMonths(keys, byMonth, (row) => n(row.deductions)) }
			]
		},
		{
			key: 'payroll-staff-count',
			title: 'Employees Paid Each Month',
			group: 'Payroll',
			kind: 'line',
			labels: keys,
			series: [{ label: 'Employees', data: alignMonths(keys, byMonth, (row) => n(row.staff)) }]
		},
		{
			key: 'payroll-by-department',
			title: 'Net Pay by Department',
			group: 'Payroll',
			kind: 'bar',
			money: true,
			labels: topN(byDepartment.map(toBreakdown), 12).map((row) => row.label),
			series: [
				{
					label: 'Net pay',
					data: topN(byDepartment.map(toBreakdown), 12).map((row) => row.value)
				}
			]
		},
		{
			key: 'payroll-by-branch',
			title: 'Net Pay by Branch',
			group: 'Payroll',
			kind: 'bar',
			money: true,
			labels: topN(byBranch.map(toBreakdown), 12).map((row) => row.label),
			series: [
				{ label: 'Net pay', data: topN(byBranch.map(toBreakdown), 12).map((row) => row.value) }
			]
		},
		{
			key: 'payroll-by-method',
			title: 'Net Pay by Payment Method',
			group: 'Payroll',
			kind: 'doughnut',
			money: true,
			labels: topN(byMethod.map(toBreakdown)).map((row) => row.label),
			series: [{ label: 'Net pay', data: topN(byMethod.map(toBreakdown)).map((row) => row.value) }]
		},
		{
			key: 'payslip-status',
			title: 'Payslip Status',
			group: 'Payroll',
			kind: 'doughnut',
			labels: topN(byStatus.map(toBreakdown)).map((row) => row.label),
			series: [{ label: 'Payslips', data: topN(byStatus.map(toBreakdown)).map((row) => row.value) }]
		},
		{
			key: 'payroll-top-earners',
			title: 'Highest Paid in the Range',
			description: 'Total net pay per employee across every payslip in the range.',
			group: 'Payroll',
			kind: 'bar',
			money: true,
			labels: topEarners.map((row) => row.label ?? 'Unknown'),
			series: [{ label: 'Net pay', data: topEarners.map((row) => n(row.value)) }]
		},
		{
			key: 'payroll-runs-period',
			title: 'Payroll Runs by Ethiopian Period',
			description: 'Totals as recorded on each finalised run.',
			group: 'Payroll',
			kind: 'bar',
			money: true,
			wide: true,
			labels: byPeriod.map((row) => row.label),
			series: [
				{ label: 'Gross', data: byPeriod.map((row) => n(row.gross)) },
				{ label: 'Net', data: byPeriod.map((row) => n(row.net)) },
				{ label: 'Tax', data: byPeriod.map((row) => n(row.tax)) },
				{ label: 'Pension', data: byPeriod.map((row) => n(row.pension)) }
			]
		},
		{
			key: 'payroll-adjustments-month',
			title: 'Payroll Adjustments',
			description: 'Bonuses and deductions applied after a payslip was cut.',
			group: 'Payroll',
			kind: 'bar',
			money: true,
			labels: keys,
			series: [
				{ label: 'Bonus', data: alignMonths(keys, adjustmentsByMonth, (row) => n(row.bonus)) },
				{
					label: 'Deduction',
					data: alignMonths(keys, adjustmentsByMonth, (row) => -n(row.deduction))
				}
			]
		}
	];

	return { stats, charts };
}

/** Aggregates arrive as `{ label, value: string }`; breakdown helpers want numbers. */
function toBreakdown(row: { label: string | null; value: string | number }) {
	return { label: row.label, value: n(row.value) };
}
