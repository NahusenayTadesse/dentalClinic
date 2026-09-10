import { count, countDistinct, desc, eq, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import {
	employee,
	expenses,
	expensesType,
	paymentMethods,
	services,
	transactionServices,
	transactionSupplies,
	transactions
} from '$lib/server/db/schema';
import { notDeleted } from '$lib/server/softDelete';
import type { ReportFilters } from '../filters';
import type { ReportChartData, Stat } from '../types';
import {
	alignMonths,
	all,
	amountScope,
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
 * Cash: what was transacted, what was spent, and what services earned.
 *
 * Bank rows are signed — a deposit is positive, a payout negative — so the
 * balance is the sum of its history. Splitting the sign in SQL keeps inflow and
 */
export async function moneyStats(
	filters: ReportFilters
): Promise<{ stats: Stat[]; charts: ReportChartData[] }> {
	const keys = monthKeys(filters);
	const scope = staffScope(filters);

	const transactionWhere = all([
		notDeleted(transactions),
		inRange(transactions.createdAt, filters),
		filters.paymentMethodId ? eq(transactions.paymentMethodId, filters.paymentMethodId) : undefined,
		filters.transactionStatus
			? sql`${transactions.paymentStatus} = ${filters.transactionStatus}`
			: undefined,
		...amountScope(transactions.amount, filters)
	]);

	const expenseWhere = all([
		notDeleted(expenses),
		inRange(expenses.expenseDate, filters),
		filters.expenseTypeId ? eq(expenses.type, filters.expenseTypeId) : undefined,
		...amountScope(expenses.total, filters)
	]);

	const serviceWhere = all([
		notDeleted(transactionServices),
		notDeleted(employee),
		inRange(transactionServices.createdAt, filters),
		filters.serviceId ? eq(transactionServices.serviceId, filters.serviceId) : undefined,
		...scope
	]);

	const [
		[transactionTotals],
		[expenseTotals],
		[serviceTotals],
		[supplySales],
		transactionsByMonth,
		transactionsByStatus,
		transactionsByMethod,
		expensesByMonth,
		expensesByType,
		servicesByMonth,
		revenueByService,
		revenueByStaff
	] = await Promise.all([
		db
			.select({
				total: count(),
				amount: total(transactions.amount),
				paid: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.paymentStatus} = 'paid' THEN ${transactions.amount} ELSE 0 END), 0)`,
				pending: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.paymentStatus} IN ('pending', 'unpaid', 'partially_paid') THEN ${transactions.amount} ELSE 0 END), 0)`,
				refunded: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.paymentStatus} IN ('refunded', 'partially_refunded') THEN ${transactions.amount} ELSE 0 END), 0)`
			})
			.from(transactions)
			.where(transactionWhere),

		db
			.select({
				total: count(),
				amount: total(expenses.total),
				types: countDistinct(expenses.type)
			})
			.from(expenses)
			.where(expenseWhere),

		db
			.select({
				total: count(),
				revenue: total(transactionServices.price),
				tips: total(transactionServices.tip),
				tax: total(transactionServices.tax),
				billed: total(transactionServices.total),
				staff: countDistinct(transactionServices.staffId),
				kinds: countDistinct(transactionServices.serviceId)
			})
			.from(transactionServices)
			.innerJoin(employee, eq(transactionServices.staffId, employee.id))
			.where(serviceWhere),

		db
			.select({
				lines: count(),
				value: sql<string>`COALESCE(SUM(${transactionSupplies.quantity} * ${transactionSupplies.unitPrice}), 0)`,
				units: total(transactionSupplies.quantity)
			})
			.from(transactionSupplies)
			.where(
				all([notDeleted(transactionSupplies), inRange(transactionSupplies.createdAt, filters)])
			),

		db
			.select({
				bucket: monthOf(transactions.createdAt),
				value: total(transactions.amount),
				entries: count()
			})
			.from(transactions)
			.where(transactionWhere)
			.groupBy(sql`1`),

		db
			.select({
				label: sql<string>`${transactions.paymentStatus}`,
				value: count(),
				amount: total(transactions.amount)
			})
			.from(transactions)
			.where(transactionWhere)
			.groupBy(transactions.paymentStatus),

		db
			.select({ label: paymentMethods.name, value: total(transactions.amount) })
			.from(transactions)
			.leftJoin(paymentMethods, eq(transactions.paymentMethodId, paymentMethods.id))
			.where(transactionWhere)
			.groupBy(paymentMethods.name),

		db
			.select({
				bucket: monthOf(expenses.expenseDate),
				value: total(expenses.total),
				entries: count()
			})
			.from(expenses)
			.where(expenseWhere)
			.groupBy(sql`1`),

		db
			.select({ label: expensesType.name, value: total(expenses.total) })
			.from(expenses)
			.leftJoin(expensesType, eq(expenses.type, expensesType.id))
			.where(expenseWhere)
			.groupBy(expensesType.name),

		db
			.select({
				bucket: monthOf(transactionServices.createdAt),
				value: total(transactionServices.price),
				tips: total(transactionServices.tip),
				entries: count()
			})
			.from(transactionServices)
			.innerJoin(employee, eq(transactionServices.staffId, employee.id))
			.where(serviceWhere)
			.groupBy(sql`1`),

		db
			.select({ label: services.name, value: total(transactionServices.price) })
			.from(transactionServices)
			.innerJoin(employee, eq(transactionServices.staffId, employee.id))
			.leftJoin(services, eq(transactionServices.serviceId, services.id))
			.where(serviceWhere)
			.groupBy(services.name),

		db
			.select({ label: staffName, value: total(transactionServices.price) })
			.from(transactionServices)
			.innerJoin(employee, eq(transactionServices.staffId, employee.id))
			.where(serviceWhere)
			.groupBy(employee.id)
			.orderBy(desc(total(transactionServices.price)))
			.limit(12)
	]);

	const stats: Stat[] = [
		{
			key: 'transactions',
			label: 'Transactions',
			value: n(transactionTotals?.total),
			format: 'count',
			group: 'Money',
			hint: 'Recorded inside the range',
			section: 'transactions',
			tone: 'neutral'
		},
		{
			key: 'transaction-value',
			label: 'Transaction Value',
			value: n(transactionTotals?.amount),
			format: 'money',
			group: 'Money',
			hint: 'Every transaction, whatever its status',
			section: 'transactions',
			tone: 'neutral'
		},
		{
			key: 'transaction-outstanding',
			label: 'Outstanding',
			value: n(transactionTotals?.pending),
			format: 'money',
			group: 'Money',
			hint: 'Pending, unpaid or part paid',
			section: 'transactions',
			tone: 'warning'
		},
		{
			key: 'expenses',
			label: 'Expenses',
			value: n(expenseTotals?.amount),
			format: 'money',
			group: 'Money',
			hint: `${n(expenseTotals?.total)} expenses across ${n(expenseTotals?.types)} types`,
			section: 'expenses',
			tone: 'negative'
		},
		{
			key: 'service-revenue',
			label: 'Service Revenue',
			value: n(serviceTotals?.revenue),
			format: 'money',
			group: 'Money',
			hint: `${n(serviceTotals?.total)} services by ${n(serviceTotals?.staff)} staff`,
			section: 'services-rendered',
			tone: 'positive'
		},
		{
			key: 'service-tips',
			label: 'Tips',
			value: n(serviceTotals?.tips),
			format: 'money',
			group: 'Money',
			hint: 'Collected on rendered services',
			section: 'services-rendered',
			tone: 'positive'
		},
		{
			key: 'supply-sales',
			label: 'Supplies Sold',
			value: n(supplySales?.value),
			format: 'money',
			group: 'Money',
			hint: `${n(supplySales?.units)} units over ${n(supplySales?.lines)} lines`,
			tone: 'positive'
		}
	];

	const charts: ReportChartData[] = [
		{
			key: 'transactions-month',
			title: 'Transaction Value per Month',
			group: 'Money',
			kind: 'line',
			labels: keys,
			money: true,
			series: [
				{ label: 'Value', data: alignMonths(keys, transactionsByMonth, (row) => n(row.value)) }
			]
		},
		{
			key: 'transactions-count-month',
			title: 'Transaction Count per Month',
			group: 'Money',
			kind: 'bar',
			labels: keys,
			series: [
				{
					label: 'Transactions',
					data: alignMonths(keys, transactionsByMonth, (row) => n(row.entries))
				}
			]
		},
		{
			key: 'transaction-status',
			title: 'Transactions by Status',
			group: 'Money',
			kind: 'doughnut',
			labels: topN(transactionsByStatus.map(toBreakdown)).map((row) => row.label),
			series: [
				{
					label: 'Transactions',
					data: topN(transactionsByStatus.map(toBreakdown)).map((row) => row.value)
				}
			]
		},
		{
			key: 'transaction-method',
			title: 'Value by Payment Method',
			group: 'Money',
			kind: 'doughnut',
			money: true,
			labels: topN(transactionsByMethod.map(toBreakdown)).map((row) => row.label),
			series: [
				{
					label: 'Value',
					data: topN(transactionsByMethod.map(toBreakdown)).map((row) => row.value)
				}
			]
		},
		{
			key: 'expenses-month',
			title: 'Expenses per Month',
			group: 'Money',
			kind: 'bar',
			labels: keys,
			money: true,
			series: [
				{ label: 'Expenses', data: alignMonths(keys, expensesByMonth, (row) => n(row.value)) }
			]
		},
		{
			key: 'expenses-by-type',
			title: 'Expenses by Type',
			group: 'Money',
			kind: 'bar',
			money: true,
			wide: true,
			labels: topN(expensesByType.map(toBreakdown), 14).map((row) => row.label),
			series: [
				{ label: 'Spent', data: topN(expensesByType.map(toBreakdown), 14).map((row) => row.value) }
			]
		},
		{
			key: 'service-revenue-month',
			title: 'Service Revenue per Month',
			group: 'Money',
			kind: 'line',
			labels: keys,
			money: true,
			series: [
				{ label: 'Revenue', data: alignMonths(keys, servicesByMonth, (row) => n(row.value)) },
				{ label: 'Tips', data: alignMonths(keys, servicesByMonth, (row) => n(row.tips)) }
			]
		},
		{
			key: 'revenue-by-service',
			title: 'Revenue by Service',
			group: 'Money',
			kind: 'doughnut',
			money: true,
			labels: topN(revenueByService.map(toBreakdown)).map((row) => row.label),
			series: [
				{ label: 'Revenue', data: topN(revenueByService.map(toBreakdown)).map((row) => row.value) }
			]
		},
		{
			key: 'revenue-by-staff',
			title: 'Revenue by Employee',
			group: 'Money',
			kind: 'bar',
			money: true,
			labels: revenueByStaff.map((row) => row.label ?? 'Unknown'),
			series: [{ label: 'Revenue', data: revenueByStaff.map((row) => n(row.value)) }]
		}
	];

	return { stats, charts };
}

function toBreakdown(row: { label: string | null; value: string | number }) {
	return { label: row.label, value: n(row.value) };
}
