import { count, countDistinct, desc, eq, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import {
	contractRenewals,
	customers,
	paymentRequest,
	services,
	site,
	siteContracts,
	siteMonthlyPayments,
	sitePenalties
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
	topN,
	total
} from '../scope.server';

/**
 * The revenue side: who the customers are, what was contracted, what was
 * invoiced, and what actually came in.
 */
export async function commercialStats(
	filters: ReportFilters
): Promise<{ stats: Stat[]; charts: ReportChartData[] }> {
	const keys = monthKeys(filters);

	const contractScope = [
		filters.siteId ? eq(siteContracts.siteId, filters.siteId) : undefined,
		filters.customerId ? eq(siteContracts.customerId, filters.customerId) : undefined,
		filters.serviceId ? eq(siteContracts.serviceId, filters.serviceId) : undefined
	];

	const paymentWhere = all([
		notDeleted(siteMonthlyPayments),
		notDeleted(siteContracts),
		inRange(siteMonthlyPayments.date, filters),
		filters.approvalStatus
			? sql`${siteMonthlyPayments.status} = ${filters.approvalStatus}`
			: undefined,
		...amountScope(siteMonthlyPayments.paymentAmount, filters),
		...contractScope
	]);

	const requestWhere = all([
		notDeleted(paymentRequest),
		inRange(paymentRequest.requestDate, filters),
		filters.siteId ? eq(paymentRequest.siteId, filters.siteId) : undefined,
		filters.approvalStatus ? sql`${paymentRequest.status} = ${filters.approvalStatus}` : undefined,
		...amountScope(paymentRequest.amount, filters)
	]);

	const contractWhere = all([
		notDeleted(siteContracts),
		inRange(siteContracts.contractDate, filters),
		...contractScope
	]);

	// `siteMonthlyPayments.vat` holds the *rate* (15), not the money — the add
	// payment form derives `beforeVat` as `amount / (1 + rate/100)`. Summing the
	// column would total the rates, so the VAT actually charged is the gap
	// between what was paid and the pre-VAT figure.
	const vatAmount = sql<string>`COALESCE(SUM(${siteMonthlyPayments.paymentAmount} - ${siteMonthlyPayments.beforeVat}), 0)`;

	const [
		[payments],
		[requests],
		[contracts],
		[liveContracts],
		[renewals],
		[penalties],
		[customerTotals],
		[siteTotals],
		paymentsByMonth,
		paymentsByStatus,
		paymentsBySite,
		requestsByStatus,
		contractsByMonth,
		contractsByService,
		contractValueByCustomer,
		customersByStatus,
		customersByMonth
	] = await Promise.all([
		db
			.select({
				total: count(),
				collected: total(siteMonthlyPayments.paymentAmount),
				beforeVat: total(siteMonthlyPayments.beforeVat),
				vat: vatAmount,
				withheld: total(siteMonthlyPayments.withholdAmount),
				penalty: total(siteMonthlyPayments.penaltyAmount),
				approved: countWhen(sql`${siteMonthlyPayments.status} = 'approved'`),
				pending: countWhen(sql`${siteMonthlyPayments.status} = 'pending'`),
				rejected: countWhen(sql`${siteMonthlyPayments.status} = 'rejected'`)
			})
			.from(siteMonthlyPayments)
			.innerJoin(siteContracts, eq(siteMonthlyPayments.contractId, siteContracts.id))
			.where(paymentWhere),

		db
			.select({
				total: count(),
				amount: total(paymentRequest.amount),
				approved: countWhen(sql`${paymentRequest.status} = 'approved'`),
				pending: countWhen(sql`${paymentRequest.status} = 'pending'`),
				rejected: countWhen(sql`${paymentRequest.status} = 'rejected'`),
				penalty: total(paymentRequest.penality)
			})
			.from(paymentRequest)
			.where(requestWhere),

		db
			.select({
				signed: count(),
				value: total(siteContracts.monthlyAmount),
				terminated: countWhen(sql`${siteContracts.terminated} = true`)
			})
			.from(siteContracts)
			.where(contractWhere),

		db
			.select({
				live: count(),
				value: total(siteContracts.monthlyAmount),
				sites: countDistinct(siteContracts.siteId),
				customers: countDistinct(siteContracts.customerId)
			})
			.from(siteContracts)
			.where(
				all([
					notDeleted(siteContracts),
					sql`${siteContracts.terminated} = false`,
					sql`${siteContracts.endDate} >= CURDATE()`,
					...contractScope
				])
			),

		db
			.select({ total: count(), value: total(contractRenewals.renewalAmount) })
			.from(contractRenewals)
			.innerJoin(siteContracts, eq(contractRenewals.contractId, siteContracts.id))
			.where(
				all([
					notDeleted(contractRenewals),
					notDeleted(siteContracts),
					inRange(contractRenewals.renewalDate, filters),
					...contractScope
				])
			),

		db
			.select({ total: count(), amount: total(sitePenalties.penaltyAmount) })
			.from(sitePenalties)
			.innerJoin(siteContracts, eq(sitePenalties.contractId, siteContracts.id))
			.where(
				all([
					notDeleted(sitePenalties),
					notDeleted(siteContracts),
					inRange(sitePenalties.penaltyDate, filters),
					...contractScope
				])
			),

		db
			.select({
				total: count(),
				added: countWhen(
					sql`${customers.createdAt} >= ${filters.dateStart} AND ${customers.createdAt} < DATE_ADD(${filters.dateEnd}, INTERVAL 1 DAY)`
				)
			})
			.from(customers)
			.where(
				all([
					notDeleted(customers),
					filters.customerId ? eq(customers.id, filters.customerId) : undefined
				])
			),

		db
			.select({
				total: count(),
				added: countWhen(
					sql`${site.startDate} >= ${filters.dateStart} AND ${site.startDate} < DATE_ADD(${filters.dateEnd}, INTERVAL 1 DAY)`
				),
				active: countWhen(sql`${site.isActive} = true`)
			})
			.from(site)
			.where(
				all([
					notDeleted(site),
					filters.siteId ? eq(site.id, filters.siteId) : undefined,
					filters.customerId ? eq(site.customerId, filters.customerId) : undefined
				])
			),

		db
			.select({
				bucket: monthOf(siteMonthlyPayments.date),
				value: total(siteMonthlyPayments.paymentAmount),
				vat: vatAmount,
				withheld: total(siteMonthlyPayments.withholdAmount),
				penalty: total(siteMonthlyPayments.penaltyAmount)
			})
			.from(siteMonthlyPayments)
			.innerJoin(siteContracts, eq(siteMonthlyPayments.contractId, siteContracts.id))
			.where(paymentWhere)
			.groupBy(sql`1`),

		db
			.select({ label: sql<string>`${siteMonthlyPayments.status}`, value: count() })
			.from(siteMonthlyPayments)
			.innerJoin(siteContracts, eq(siteMonthlyPayments.contractId, siteContracts.id))
			.where(paymentWhere)
			.groupBy(siteMonthlyPayments.status),

		db
			.select({ label: site.name, value: total(siteMonthlyPayments.paymentAmount) })
			.from(siteMonthlyPayments)
			.innerJoin(siteContracts, eq(siteMonthlyPayments.contractId, siteContracts.id))
			.leftJoin(site, eq(siteContracts.siteId, site.id))
			.where(paymentWhere)
			.groupBy(site.name)
			.orderBy(desc(total(siteMonthlyPayments.paymentAmount)))
			.limit(14),

		db
			.select({ label: sql<string>`${paymentRequest.status}`, value: total(paymentRequest.amount) })
			.from(paymentRequest)
			.where(requestWhere)
			.groupBy(paymentRequest.status),

		db
			.select({
				bucket: monthOf(siteContracts.contractDate),
				value: count(),
				amount: total(siteContracts.monthlyAmount)
			})
			.from(siteContracts)
			.where(contractWhere)
			.groupBy(sql`1`),

		db
			.select({ label: services.name, value: total(siteContracts.monthlyAmount) })
			.from(siteContracts)
			.leftJoin(services, eq(siteContracts.serviceId, services.id))
			.where(contractWhere)
			.groupBy(services.name),

		db
			.select({ label: customers.name, value: total(siteContracts.monthlyAmount) })
			.from(siteContracts)
			.leftJoin(customers, eq(siteContracts.customerId, customers.id))
			.where(
				all([notDeleted(siteContracts), sql`${siteContracts.terminated} = false`, ...contractScope])
			)
			.groupBy(customers.name)
			.orderBy(desc(total(siteContracts.monthlyAmount)))
			.limit(14),

		db
			.select({ label: sql<string>`${customers.status}`, value: count() })
			.from(customers)
			.where(notDeleted(customers))
			.groupBy(customers.status),

		db
			.select({ bucket: monthOf(customers.createdAt), value: count() })
			.from(customers)
			.where(all([notDeleted(customers), inRange(customers.createdAt, filters)]))
			.groupBy(sql`1`)
	]);

	const stats: Stat[] = [
		{
			key: 'revenue-collected',
			label: 'Revenue Collected',
			value: n(payments?.collected),
			format: 'money',
			group: 'Commercial',
			hint: `${n(payments?.total)} site payments recorded`,
			section: 'site-payments',
			tone: 'positive'
		},
		{
			key: 'revenue-before-vat',
			label: 'Revenue Before VAT',
			value: n(payments?.beforeVat),
			format: 'money',
			group: 'Commercial',
			hint: `VAT of ${Math.round(n(payments?.vat)).toLocaleString()} on top`,
			section: 'site-payments',
			tone: 'neutral'
		},
		{
			key: 'withheld',
			label: 'Withholding',
			value: n(payments?.withheld),
			format: 'money',
			group: 'Commercial',
			hint: 'Held back by customers',
			section: 'site-payments',
			tone: 'warning'
		},
		{
			key: 'payments-pending',
			label: 'Payments Awaiting Approval',
			value: n(payments?.pending),
			format: 'count',
			group: 'Commercial',
			hint: `${n(payments?.approved)} approved · ${n(payments?.rejected)} rejected`,
			section: 'site-payments',
			tone: n(payments?.pending) > 0 ? 'warning' : 'positive'
		},
		{
			key: 'requests-raised',
			label: 'Invoiced',
			value: n(requests?.amount),
			format: 'money',
			group: 'Commercial',
			hint: `${n(requests?.total)} payment requests raised`,
			section: 'payment-requests',
			tone: 'neutral'
		},
		{
			key: 'collection-rate',
			label: 'Collection Rate',
			value: n(requests?.amount) ? (n(payments?.collected) / n(requests?.amount)) * 100 : 0,
			format: 'percent',
			group: 'Commercial',
			hint: 'Collected against invoiced in the range',
			tone: 'neutral'
		},
		{
			key: 'contracts-signed',
			label: 'Contracts Signed',
			value: n(contracts?.signed),
			format: 'count',
			group: 'Commercial',
			hint: `${Math.round(n(contracts?.value)).toLocaleString()} ETB monthly value added`,
			section: 'contracts',
			tone: 'positive'
		},
		{
			key: 'contracts-live',
			label: 'Contracts Running',
			value: n(liveContracts?.live),
			format: 'count',
			group: 'Commercial',
			hint: `${n(liveContracts?.sites)} sites · ${n(liveContracts?.customers)} customers`,
			section: 'contracts',
			tone: 'neutral'
		},
		{
			key: 'contract-book',
			label: 'Monthly Contract Book',
			value: n(liveContracts?.value),
			format: 'money',
			group: 'Commercial',
			hint: 'Recurring value of every live contract',
			section: 'contracts',
			tone: 'positive'
		},
		{
			key: 'contracts-terminated',
			label: 'Contracts Terminated',
			value: n(contracts?.terminated),
			format: 'count',
			group: 'Commercial',
			hint: 'Signed in the range and already ended',
			section: 'contracts',
			tone: 'negative'
		},
		{
			key: 'renewals',
			label: 'Renewals',
			value: n(renewals?.total),
			format: 'count',
			group: 'Commercial',
			hint: `${Math.round(n(renewals?.value)).toLocaleString()} ETB renewed`,
			section: 'renewals',
			tone: 'positive'
		},
		{
			key: 'site-penalties',
			label: 'Penalties Charged',
			value: n(penalties?.amount),
			format: 'money',
			group: 'Commercial',
			hint: `${n(penalties?.total)} penalties against contracts`,
			section: 'site-penalties',
			tone: 'negative'
		},
		{
			key: 'customers',
			label: 'Customers',
			value: n(customerTotals?.total),
			format: 'count',
			group: 'Commercial',
			hint: `${n(customerTotals?.added)} added inside the range`,
			section: 'customers',
			tone: 'neutral'
		},
		{
			key: 'sites',
			label: 'Sites',
			value: n(siteTotals?.total),
			format: 'count',
			group: 'Commercial',
			hint: `${n(siteTotals?.active)} active · ${n(siteTotals?.added)} started in range`,
			section: 'sites',
			tone: 'neutral'
		}
	];

	const charts: ReportChartData[] = [
		{
			key: 'revenue-month',
			title: 'Revenue Collected per Month',
			description: 'Payment, VAT, withholding and penalty on every site payment.',
			group: 'Commercial',
			kind: 'bar',
			labels: keys,
			money: true,
			wide: true,
			series: [
				{ label: 'Collected', data: alignMonths(keys, paymentsByMonth, (row) => n(row.value)) },
				{ label: 'VAT', data: alignMonths(keys, paymentsByMonth, (row) => n(row.vat)) },
				{ label: 'Withheld', data: alignMonths(keys, paymentsByMonth, (row) => n(row.withheld)) },
				{ label: 'Penalty', data: alignMonths(keys, paymentsByMonth, (row) => n(row.penalty)) }
			]
		},
		{
			key: 'revenue-by-site',
			title: 'Revenue by Site',
			group: 'Commercial',
			kind: 'bar',
			money: true,
			wide: true,
			labels: paymentsBySite.map((row) => row.label ?? 'Unknown'),
			series: [{ label: 'Collected', data: paymentsBySite.map((row) => n(row.value)) }]
		},
		{
			key: 'payment-status',
			title: 'Site Payments by Status',
			group: 'Commercial',
			kind: 'doughnut',
			labels: topN(paymentsByStatus.map(toBreakdown)).map((row) => row.label),
			series: [
				{ label: 'Payments', data: topN(paymentsByStatus.map(toBreakdown)).map((row) => row.value) }
			]
		},
		{
			key: 'request-status',
			title: 'Invoiced Value by Status',
			group: 'Commercial',
			kind: 'doughnut',
			money: true,
			labels: topN(requestsByStatus.map(toBreakdown)).map((row) => row.label),
			series: [
				{ label: 'Invoiced', data: topN(requestsByStatus.map(toBreakdown)).map((row) => row.value) }
			]
		},
		{
			key: 'contracts-month',
			title: 'Contracts Signed per Month',
			group: 'Commercial',
			kind: 'bar',
			labels: keys,
			series: [
				{ label: 'Contracts', data: alignMonths(keys, contractsByMonth, (row) => n(row.value)) }
			]
		},
		{
			key: 'contract-value-month',
			title: 'Contract Value Added per Month',
			group: 'Commercial',
			kind: 'line',
			labels: keys,
			money: true,
			series: [
				{
					label: 'Monthly value',
					data: alignMonths(keys, contractsByMonth, (row) => n(row.amount))
				}
			]
		},
		{
			key: 'contracts-by-service',
			title: 'Contract Value by Service',
			group: 'Commercial',
			kind: 'doughnut',
			money: true,
			labels: topN(contractsByService.map(toBreakdown)).map((row) => row.label),
			series: [
				{ label: 'Value', data: topN(contractsByService.map(toBreakdown)).map((row) => row.value) }
			]
		},
		{
			key: 'contract-book-by-customer',
			title: 'Live Contract Book by Customer',
			description: 'Recurring monthly value of contracts that have not been terminated.',
			group: 'Commercial',
			kind: 'bar',
			money: true,
			wide: true,
			labels: contractValueByCustomer.map((row) => row.label ?? 'Unknown'),
			series: [{ label: 'Monthly value', data: contractValueByCustomer.map((row) => n(row.value)) }]
		},
		{
			key: 'customers-status',
			title: 'Customers by Status',
			group: 'Commercial',
			kind: 'doughnut',
			labels: topN(customersByStatus.map(toBreakdown)).map((row) => row.label),
			series: [
				{
					label: 'Customers',
					data: topN(customersByStatus.map(toBreakdown)).map((row) => row.value)
				}
			]
		},
		{
			key: 'customers-month',
			title: 'Customers Added per Month',
			group: 'Commercial',
			kind: 'bar',
			labels: keys,
			series: [
				{ label: 'Customers', data: alignMonths(keys, customersByMonth, (row) => n(row.value)) }
			]
		}
	];

	return { stats, charts };
}

function toBreakdown(row: { label: string | null; value: string | number }) {
	return { label: row.label, value: n(row.value) };
}
