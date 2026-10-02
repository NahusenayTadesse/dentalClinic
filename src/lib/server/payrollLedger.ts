import { and, desc, eq, like, or, sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import type { AnyMySqlColumn, MySqlTable, SelectedFields } from 'drizzle-orm/mysql-core';

import { db } from '$lib/server/db';
import { joinedSelect } from '$lib/server/db/joinedSelect';
import {
	bonuses,
	deductions,
	department,
	employee,
	overTime,
	overTimeType,
	payrollEntries,
	position,
	user
} from '$lib/server/db/schema';
import { notDeleted } from '$lib/server/softDelete';
import { isApproved } from '$lib/server/approvals';
import type { AuditedTable } from '$lib/server/audit';
import { isoDate } from '$lib/server/db/dialect';
import { branchFilter, type BranchContext } from '$lib/server/branchScope';
import { employeeLegalName } from '$lib/server/employeeName';
import { buildWhere, facetCounts, type TableQuery, type WhereSpec } from '$lib/server/queryFilters';
import { cents } from '$lib/invoiceStatus';
import type { LedgerKind } from '$lib/payrollLedger';

/**
 * Overtime, bonuses and deductions: the dated amounts the next payroll run adds to or takes from
 * an employee's pay (`server/payrollRun.ts`). One module for the three, because they are one
 * shape — an employee, a day, an amount, a reason — and were two hand-copied month pages.
 *
 * **Any period, not a month.** The list is read through `queryFilters` like the patient list:
 * a date window, search, sort, paging, and facets counted over the whole result. The old pages
 * could only show one Ethiopian month at a time, one row per employee with that month's entries
 * nested inside.
 *
 * **The rules are in `payrollLedgerWrites.ts`, inside the write's transaction.** Each was missing
 * or broken before:
 *
 *   - an unapproved employee collects nothing (`unapprovedEmployeeIds`);
 *   - **a paid month is closed.** An adjustment dated inside a payslip's period would never be
 *     paid — the run that covered it is over — so it is refused, and so is editing or removing one
 *     that was paid;
 *   - **overtime is priced from the salary in force that day,** approved, one per employee. It
 *     read whichever salary row came first — an old one, an unapproved one — and a bulk add made
 *     one entry *per salary row*, so anyone with a pay history was paid overtime twice; anyone with
 *     no salary was silently skipped. Both are now refused by name;
 *   - an overtime type's hour limit is a refusal that rolls back. It set an error message and then
 *     inserted anyway, because the message was set inside the transaction that went on to commit;
 *   - `amount_per_hour` is NOT NULL with no default, and was never written, so recording overtime
 *     here could not succeed against a strict database.
 *
 * Audited (`over_time`, `bonuses`, `deductions` are money, CLAUDE.md §11). A bulk entry is one
 * audit row naming every record it made, not a row per employee.
 *
 * Non-goal: attendance. An absence is priced by the run from the day count, not entered as an
 * amount, and it has its own screen.
 */

/** What each kind reads from. */
export type Source = {
	table: MySqlTable & {
		id: AnyMySqlColumn;
		deletedAt: AnyMySqlColumn;
		deletedBy: AnyMySqlColumn;
	};
	audit: AuditedTable;
	id: AnyMySqlColumn;
	staffId: AnyMySqlColumn;
	date: AnyMySqlColumn;
	amount: AnyMySqlColumn;
	hours: AnyMySqlColumn | null;
	reason: AnyMySqlColumn | null;
	createdBy: AnyMySqlColumn;
	/** The type's label, and the value its facet filters on. */
	type: SQL<string | null> | null;
	typeValue: SQL<string | number | null> | null;
};

/** What each kind reads from — shared with the writes in `payrollLedgerWrites.ts`. */
export const SOURCES: Record<LedgerKind, Source> = {
	overtime: {
		table: overTime,
		audit: 'over_time',
		id: overTime.id,
		staffId: overTime.staffId,
		date: overTime.date,
		amount: overTime.total,
		hours: overTime.hours,
		reason: overTime.reason,
		createdBy: overTime.createdBy,
		type: sql<string | null>`${overTimeType.name}`,
		typeValue: sql<number | null>`${overTime.overTimeTypeId}`
	},
	bonuses: {
		table: bonuses,
		audit: 'bonuses',
		id: bonuses.id,
		staffId: bonuses.staffId,
		date: bonuses.bonusDate,
		amount: bonuses.amount,
		hours: null,
		reason: bonuses.description,
		createdBy: bonuses.createdBy,
		type: null,
		typeValue: null
	},
	deductions: {
		table: deductions,
		audit: 'deductions',
		id: deductions.id,
		staffId: deductions.staffId,
		date: deductions.deductionDate,
		amount: deductions.amount,
		hours: null,
		reason: deductions.reason,
		createdBy: deductions.createdBy,
		type: sql<string | null>`${deductions.type}`,
		typeValue: sql<string | null>`${deductions.type}`
	}
};

/**
 * Whether the adjustment fell inside a period somebody's payslip already covers: paid, closed.
 * Portable — a range test on the payslip's own days, no date functions (CLAUDE.md §10).
 */
function paidExpr(src: Source): SQL<number> {
	return sql<number>`exists (select 1 from ${payrollEntries}
		where ${payrollEntries.staffId} = ${src.staffId}
		and ${payrollEntries.payPeriodStart} <= ${src.date}
		and ${payrollEntries.payPeriodEnd} >= ${src.date}
		and ${payrollEntries.deletedAt} is null)`;
}

/** The filters a ledger offers, as URL params. */
export const LEDGER_FILTERS = ['departmentId', 'positionId', 'typeId', 'paid', 'staffId'] as const;
type LedgerFilter = (typeof LEDGER_FILTERS)[number];

/** What a ledger may sort by. */
export const LEDGER_SORTS = ['date', 'employee', 'amount', 'hours', 'department'] as const;

/** The `WHERE` for a kind's list: live rows, of live employees at this branch, as filtered. */
function ledgerSpec(
	kind: LedgerKind,
	branch: Pick<BranchContext, 'active'>
): WhereSpec<LedgerFilter> {
	const src = SOURCES[kind];
	return {
		base: [notDeleted(src.table), notDeleted(employee), branchFilter(employee.branchId, branch)],
		search: (term) =>
			or(
				like(employeeLegalName, `%${term}%`),
				src.reason ? like(src.reason, `%${term}%`) : undefined
			),
		dateColumn: src.date,
		filters: {
			departmentId: (v) => eq(employee.departmentId, Number(v)),
			positionId: (v) => eq(employee.positionId, Number(v)),
			staffId: (v) => eq(employee.id, Number(v)),
			typeId: (v) =>
				kind === 'overtime'
					? eq(overTime.overTimeTypeId, Number(v))
					: kind === 'deductions'
						? eq(deductions.type, v)
						: undefined,
			paid: (v) => (v === 'yes' ? sql`${paidExpr(src)}` : sql`not ${paidExpr(src)}`)
		}
	};
}

/** The kind's table joined to what the list shows and filters on. */
function joined<T extends SelectedFields>(kind: LedgerKind, fields: T) {
	const src = SOURCES[kind];
	return (
		joinedSelect(fields, src.table)
			.innerJoin(employee, eq(employee.id, src.staffId))
			.leftJoin(department, and(eq(department.id, employee.departmentId), notDeleted(department)))
			.leftJoin(position, and(eq(position.id, employee.positionId), notDeleted(position)))
			// Attribution, not filtered: a deleted user still recorded it (§9).
			.leftJoin(user, eq(user.id, src.createdBy))
			// Only overtime has a type table. For the others the join matches nothing, which keeps one
			// query shape for all three instead of a builder branched by kind.
			.leftJoin(
				overTimeType,
				kind === 'overtime' ? eq(overTimeType.id, overTime.overTimeTypeId) : sql`false`
			)
	);
}

/** One page of a kind's ledger, its whole-result totals, and its facets. */
export async function ledgerPage(
	kind: LedgerKind,
	query: TableQuery<LedgerFilter>,
	branch: Pick<BranchContext, 'active'>
) {
	const src = SOURCES[kind];
	const spec = ledgerSpec(kind, branch);
	const where = buildWhere(query, spec);

	const sortBy: Record<(typeof LEDGER_SORTS)[number], AnyMySqlColumn | SQL> = {
		date: src.date,
		employee: employeeLegalName,
		amount: src.amount,
		hours: src.hours ?? src.amount,
		department: department.name
	};
	const sort = query.sort ? sortBy[query.sort as keyof typeof sortBy] : undefined;
	const order = sort ? (query.dir === 'desc' ? desc(sort) : sort) : desc(src.date);

	const [rows, [totals]] = await Promise.all([
		joined(kind, {
			id: sql<number>`${src.id}`,
			staffId: sql<number>`${employee.id}`,
			employee: employeeLegalName,
			department: sql<string | null>`${department.name}`,
			position: sql<string | null>`${position.name}`,
			date: isoDate(src.date),
			type: src.type ?? sql<string | null>`null`,
			typeId: src.typeValue ?? sql<null>`null`,
			hours: src.hours ? sql<string | null>`${src.hours}` : sql<null>`null`,
			amount: sql<string>`${src.amount}`,
			reason: src.reason ? sql<string | null>`${src.reason}` : sql<null>`null`,
			paid: paidExpr(src),
			recordedBy: sql<string | null>`${user.name}`
		})
			.where(where)
			.orderBy(order, desc(src.id))
			.limit(query.limit)
			.offset(query.offset),
		joined(kind, {
			entries: sql<number>`count(*)`,
			employees: sql<number>`count(distinct ${employee.id})`,
			amount: sql<string>`coalesce(sum(${src.amount}), 0)`,
			hours: src.hours ? sql<string>`coalesce(sum(${src.hours}), 0)` : sql<string>`0`
		}).where(where)
	]);

	/** A facet: every filter applied but its own (`facetCounts`). */
	const facet = async (
		value: SQL<string | number | null>,
		label: SQL<string | null>,
		except: LedgerFilter
	) =>
		joined(kind, { value, label, count: sql<number>`count(*)` })
			.where(buildWhere(query, spec, { except }))
			.groupBy(value, label);

	const { type, typeValue } = src;
	const facets = await facetCounts({
		department: () => facet(sql`${department.id}`, sql`${department.name}`, 'departmentId'),
		position: () => facet(sql`${position.id}`, sql`${position.name}`, 'positionId'),
		...(type && typeValue ? { type: () => facet(typeValue, type, 'typeId') } : {}),
		paid: () =>
			facet(
				sql<string>`case when ${paidExpr(src)} then 'yes' else 'no' end`,
				sql<string>`case when ${paidExpr(src)} then 'Paid' else 'Not paid yet' end`,
				'paid'
			)
	});

	return {
		rows: rows.map((row) => ({
			...row,
			id: Number(row.id),
			staffId: Number(row.staffId),
			typeId: row.typeId === null ? null : String(row.typeId),
			hours: row.hours === null ? null : Number(row.hours),
			amount: Number(row.amount),
			paid: Boolean(Number(row.paid))
		})),
		totals: {
			entries: Number(totals?.entries ?? 0),
			employees: Number(totals?.employees ?? 0),
			amount: cents(Number(totals?.amount ?? 0)),
			hours: Number(totals?.hours ?? 0)
		},
		facets
	};
}

/** One ledger row, as the page gets it. */
export type LedgerRow = Awaited<ReturnType<typeof ledgerPage>>['rows'][number];

/** The employees an adjustment can be recorded for at this branch: active and approved. */
export async function payableEmployees(branch: Pick<BranchContext, 'active'>) {
	return db
		.select({ value: employee.id, name: employeeLegalName, department: department.name })
		.from(employee)
		.leftJoin(department, and(eq(department.id, employee.departmentId), notDeleted(department)))
		.where(
			and(
				eq(employee.isActive, true),
				isApproved(employee),
				notDeleted(employee),
				branchFilter(employee.branchId, branch)
			)
		)
		.orderBy(employeeLegalName);
}
