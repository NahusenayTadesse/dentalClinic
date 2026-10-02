import { and, desc, eq, like, sql, type SQL } from 'drizzle-orm';
import type { AnyMySqlColumn, SelectedFields } from 'drizzle-orm/mysql-core';

import { joinedSelect } from '$lib/server/db/joinedSelect';
import {
	department,
	employee,
	paymentMethods,
	payrollEntries,
	position
} from '$lib/server/db/schema';
import { notDeleted } from '$lib/server/softDelete';
import { branchFilter, type BranchContext } from '$lib/server/branchScope';
import { employeeLegalName } from '$lib/server/employeeName';
import { buildWhere, facetCounts, type TableQuery, type WhereSpec } from '$lib/server/queryFilters';
import { cents } from '$lib/invoiceStatus';

/**
 * Paid salaries: every payslip a payroll run wrote, over any period — the history the Paid
 * Salaries screen reads. A run's own page (`paid-salaries/[month_year]`) still shows one month in
 * full, with its receipts and adjustments; this is the list across months that page could not be,
 * filtered, searched, sorted, paged and totalled in SQL like the patient list (`queryFilters`).
 *
 * The amounts are the payslip's as written — this module never recomputes pay. That is
 * `server/payrollRun.ts`, which computed them in the transaction that paid them.
 *
 * Branch is the employee's (CLAUDE.md §15): `employee` is branch scoped, `payroll_entries` is not.
 */

/** The filters the list offers, as URL params. */
export const PAYSLIP_FILTERS = [
	'period',
	'departmentId',
	'positionId',
	'paymentMethodId',
	'status',
	'staffId'
] as const;
type PayslipFilter = (typeof PAYSLIP_FILTERS)[number];

/** What the list may sort by. */
export const PAYSLIP_SORTS = ['period', 'employee', 'gross', 'tax', 'net', 'department'] as const;

/** The run a payslip belongs to, as the run page's route spells it: `<month>_<year>`. */
const periodKey = sql<string>`concat(${payrollEntries.month}, '_', ${payrollEntries.year})`;
const periodLabel = sql<string>`concat(${payrollEntries.month}, ' ', ${payrollEntries.year})`;

const STATUSES = payrollEntries.status.enumValues;

function spec(branch: Pick<BranchContext, 'active'>): WhereSpec<PayslipFilter> {
	return {
		base: [
			notDeleted(payrollEntries),
			notDeleted(employee),
			branchFilter(employee.branchId, branch)
		],
		search: (term) => like(employeeLegalName, `%${term}%`),
		dateColumn: payrollEntries.payPeriodStart,
		filters: {
			period: (v) => eq(periodKey, v),
			departmentId: (v) => eq(employee.departmentId, Number(v)),
			positionId: (v) => eq(employee.positionId, Number(v)),
			paymentMethodId: (v) => eq(payrollEntries.paymentMethodId, Number(v)),
			staffId: (v) => eq(employee.id, Number(v)),
			status: (v) =>
				(STATUSES as readonly string[]).includes(v)
					? sql`${payrollEntries.status} = ${v}`
					: sql`false`
		}
	};
}

/** Payslips joined to the employee and how they were paid. */
function from<T extends SelectedFields>(fields: T) {
	return joinedSelect(fields, payrollEntries)
		.innerJoin(employee, eq(employee.id, payrollEntries.staffId))
		.leftJoin(department, and(eq(department.id, employee.departmentId), notDeleted(department)))
		.leftJoin(position, and(eq(position.id, employee.positionId), notDeleted(position)))
		.leftJoin(paymentMethods, eq(paymentMethods.id, payrollEntries.paymentMethodId));
}

/** A decimal column as a number, for the totals. */
const sum = (column: AnyMySqlColumn) => sql<string>`coalesce(sum(${column}), 0)`;

/** One page of payslips, the totals over the whole result, and the facets. */
export async function payslipPage(
	query: TableQuery<PayslipFilter>,
	branch: Pick<BranchContext, 'active'>
) {
	const where = buildWhere(query, spec(branch));

	const sortBy: Record<(typeof PAYSLIP_SORTS)[number], AnyMySqlColumn | SQL> = {
		period: payrollEntries.payPeriodStart,
		employee: employeeLegalName,
		gross: payrollEntries.grossAmount,
		tax: payrollEntries.taxAmount,
		net: payrollEntries.netAmount,
		department: department.name
	};
	const sort = query.sort ? sortBy[query.sort as keyof typeof sortBy] : undefined;
	const order = sort
		? query.dir === 'desc'
			? desc(sort)
			: sort
		: desc(payrollEntries.payPeriodStart);

	const [rows, [totals]] = await Promise.all([
		from({
			id: payrollEntries.id,
			staffId: employee.id,
			employee: employeeLegalName,
			department: department.name,
			position: position.name,
			period: periodKey,
			periodLabel,
			periodStart: payrollEntries.payPeriodStart,
			basic: payrollEntries.basicSalary,
			overtime: payrollEntries.overtimeAmount,
			bonus: payrollEntries.bonusAmount,
			commission: payrollEntries.commissionAmount,
			gross: payrollEntries.grossAmount,
			tax: payrollEntries.taxAmount,
			pension: payrollEntries.penEm,
			deductions: payrollEntries.deductions,
			absence: payrollEntries.attendancePenality,
			net: payrollEntries.netAmount,
			paymentMethod: paymentMethods.name,
			paidOn: payrollEntries.paymentDate,
			status: payrollEntries.status
		})
			.where(where)
			.orderBy(order, desc(payrollEntries.id))
			.limit(query.limit)
			.offset(query.offset),
		from({
			payslips: sql<number>`count(*)`,
			employees: sql<number>`count(distinct ${employee.id})`,
			gross: sum(payrollEntries.grossAmount),
			tax: sum(payrollEntries.taxAmount),
			pension: sql<string>`coalesce(sum(${payrollEntries.penEm}), 0) + coalesce(sum(${payrollEntries.penOrg}), 0)`,
			net: sum(payrollEntries.netAmount)
		}).where(where)
	]);

	const facet = async (
		value: SQL<string | number | null>,
		label: SQL<string | null>,
		except: PayslipFilter
	) =>
		from({ value, label, count: sql<number>`count(*)` })
			.where(buildWhere(query, spec(branch), { except }))
			.groupBy(value, label);

	const facets = await facetCounts({
		period: () => facet(periodKey, periodLabel, 'period'),
		department: () => facet(sql`${department.id}`, sql`${department.name}`, 'departmentId'),
		position: () => facet(sql`${position.id}`, sql`${position.name}`, 'positionId'),
		paymentMethod: () =>
			facet(sql`${paymentMethods.id}`, sql`${paymentMethods.name}`, 'paymentMethodId'),
		status: () => facet(sql`${payrollEntries.status}`, sql`${payrollEntries.status}`, 'status')
	});

	const money = (value: string | null) => (value === null ? null : Number(value));
	return {
		rows: rows.map((row) => ({
			...row,
			basic: money(row.basic),
			overtime: money(row.overtime),
			bonus: money(row.bonus),
			commission: money(row.commission),
			gross: money(row.gross),
			tax: money(row.tax),
			pension: money(row.pension),
			deductions: money(row.deductions),
			absence: money(row.absence),
			net: money(row.net)
		})),
		totals: {
			payslips: Number(totals?.payslips ?? 0),
			employees: Number(totals?.employees ?? 0),
			gross: cents(Number(totals?.gross ?? 0)),
			tax: cents(Number(totals?.tax ?? 0)),
			pension: cents(Number(totals?.pension ?? 0)),
			net: cents(Number(totals?.net ?? 0))
		},
		facets
	};
}
