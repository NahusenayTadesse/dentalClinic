import { and, eq, gte, lte, sql, type SQL } from 'drizzle-orm';
import type { AnyMySqlColumn } from 'drizzle-orm/mysql-core';
import { employee } from '$lib/server/db/schema';
import type { ReportFilters } from './filters';

/**
 * Query fragments shared by every dataset on the report.
 *
 * The same filter set is pointed at thirty-odd tables, so the translation from
 * "the user picked a department" to "this table's WHERE clause" lives here once
 * rather than being rewritten per query.
 */

/**
 * Inclusive on both ends, for `date`, `datetime` and `timestamp` columns alike.
 *
 * `BETWEEN start AND end` silently drops same-day rows on a datetime column,
 * because the end bound lands on midnight and everything logged during that day
 * is after it. Comparing against the start of the following day instead keeps
 * the last day of the range whole.
 */
export function inRange(column: AnyMySqlColumn, filters: ReportFilters): SQL {
	return sql`${column} >= ${filters.dateStart} AND ${column} < DATE_ADD(${filters.dateEnd}, INTERVAL 1 DAY)`;
}

/** `YYYY-MM` bucket for a time series. */
export function monthOf(column: AnyMySqlColumn): SQL<string> {
	return sql<string>`DATE_FORMAT(${column}, '%Y-%m')`;
}

/** Sum that returns 0 rather than NULL for an empty group. */
export function total(column: AnyMySqlColumn | SQL): SQL<string> {
	return sql<string>`COALESCE(SUM(${column}), 0)`;
}

/** Sums only the rows matching `when`, for side-by-side splits in one pass. */
export function totalWhen(condition: SQL, column: AnyMySqlColumn | SQL): SQL<string> {
	return sql<string>`COALESCE(SUM(CASE WHEN ${condition} THEN ${column} ELSE 0 END), 0)`;
}

export function countWhen(condition: SQL): SQL<string> {
	return sql<string>`COALESCE(SUM(CASE WHEN ${condition} THEN 1 ELSE 0 END), 0)`;
}

/** MySQL hands decimals back as strings; every aggregate goes through here. */
export function n(value: unknown): number {
	const parsed = Number(value ?? 0);
	return Number.isFinite(parsed) ? parsed : 0;
}

/** The full name, built the same way every other listing in the app builds it. */
export const staffName = sql<string>`TRIM(CONCAT(
	COALESCE(${employee.name}, ''), ' ',
	COALESCE(${employee.fatherName}, ''), ' ',
	COALESCE(${employee.grandFatherName}, '')
))`;

/**
 * Conditions that narrow a dataset by *who* it belongs to. Every caller must
 * have `employee` joined — these read its columns, not the child table's.
 */
export function staffScope(filters: ReportFilters): SQL[] {
	const conditions: SQL[] = [];

	if (filters.staffId) conditions.push(eq(employee.id, filters.staffId));
	if (filters.departmentId) conditions.push(eq(employee.departmentId, filters.departmentId));
	if (filters.positionId) conditions.push(eq(employee.positionId, filters.positionId));
	if (filters.siteId) conditions.push(eq(employee.siteId, filters.siteId));
	if (filters.gender) conditions.push(sql`${employee.gender} = ${filters.gender}`);
	if (filters.employmentStatusId) {
		conditions.push(eq(employee.employmentStatus, filters.employmentStatusId));
	}
	if (filters.educationalLevelId) {
		conditions.push(eq(employee.educationalLevel, filters.educationalLevelId));
	}

	return conditions;
}

/** Narrows a money column by the amount range in the query builder. */
export function amountScope(column: AnyMySqlColumn, filters: ReportFilters): SQL[] {
	const conditions: SQL[] = [];

	if (filters.minAmount !== null) conditions.push(gte(column, String(filters.minAmount)) as SQL);
	if (filters.maxAmount !== null) conditions.push(lte(column, String(filters.maxAmount)) as SQL);

	return conditions;
}

/** Case-insensitive contains, across however many columns a section searches. */
export function searchScope(search: string, columns: (AnyMySqlColumn | SQL)[]): SQL | undefined {
	if (!search || columns.length === 0) return undefined;

	const term = `%${search}%`;
	const parts = columns.map((column) => sql`${column} LIKE ${term}`);

	return sql`(${sql.join(parts, sql` OR `)})`;
}

/** Folds a condition list into a single WHERE, or nothing when it is empty. */
export function all(conditions: (SQL | undefined)[]): SQL | undefined {
	const kept = conditions.filter((condition): condition is SQL => condition !== undefined);
	if (kept.length === 0) return undefined;
	return kept.length === 1 ? kept[0] : (and(...kept) as SQL);
}

/**
 * Every `YYYY-MM` between the range ends, so a month with no rows still shows as
 * a gap in the line instead of being skipped and distorting the shape.
 */
export function monthKeys(filters: ReportFilters): string[] {
	const [startYear, startMonth] = filters.dateStart.split('-').map(Number);
	const [endYear, endMonth] = filters.dateEnd.split('-').map(Number);

	if (!startYear || !endYear) return [];

	const keys: string[] = [];
	let year = startYear;
	let month = startMonth;

	// A range picked backwards would otherwise loop until it ran out of memory.
	while ((year < endYear || (year === endYear && month <= endMonth)) && keys.length < 240) {
		keys.push(`${year}-${String(month).padStart(2, '0')}`);
		month += 1;
		if (month > 12) {
			month = 1;
			year += 1;
		}
	}

	return keys;
}

/** Lines up `{ bucket, … }` rows against the full month axis, zero-filling gaps. */
export function alignMonths<T extends { bucket: string | null }>(
	keys: string[],
	rows: T[],
	pick: (row: T) => number
): number[] {
	const byBucket = new Map(rows.map((row) => [row.bucket ?? '', pick(row)]));
	return keys.map((key) => byBucket.get(key) ?? 0);
}

/** Sorts a breakdown biggest-first and folds the tail into one "Other" slice. */
/**
 * The default of 7 is deliberate: with the tail folded in, a categorical chart
 * lands on at most 8 slices, which is exactly how many hues the palette has.
 * A ninth would have to reuse a colour and two categories would read as one.
 */
export function topN(
	rows: { label: string | null; value: number }[],
	limit = 7
): { label: string; value: number }[] {
	const named = rows
		.map((row) => ({ label: row.label?.trim() || 'Unassigned', value: row.value }))
		.filter((row) => row.value !== 0)
		.sort((a, b) => Math.abs(b.value) - Math.abs(a.value));

	if (named.length <= limit) return named;

	const head = named.slice(0, limit);
	const tail = named.slice(limit).reduce((sum, row) => sum + row.value, 0);

	return tail === 0 ? head : [...head, { label: `Other (${named.length - limit})`, value: tail }];
}
