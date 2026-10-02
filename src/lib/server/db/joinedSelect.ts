import type { SQL } from 'drizzle-orm';
import type { AnyMySqlColumn, MySqlTable, SelectedFields } from 'drizzle-orm/mysql-core';

import { db } from '$lib/server/db';

/**
 * A select whose fields the caller chooses, over a table, with joins added after — typed.
 *
 * **Why it exists.** A module that serves several lists from one join (rows, totals and each facet
 * select different fields from the same tables) wants one function that builds the join for any
 * selection. Drizzle cannot type that: once the selection is a generic parameter, its builder stops
 * offering `leftJoin` after the first join, so the helper does not compile. `crud.ts` met the same
 * wall and answered it with `DynamicListQuery`; this is that answer, shared, with the row type
 * carried through rather than given up.
 *
 * The one cast is here, named, and it is sound for what the type allows: every method listed is one
 * Drizzle's dynamic builder has, returning the same builder (CLAUDE.md §3).
 *
 *     const joined = <T extends SelectedFields>(fields: T) =>
 *       joinedSelect(fields, payrollEntries)
 *         .innerJoin(employee, eq(employee.id, payrollEntries.staffId));
 *
 * Non-goal: anything Drizzle's own types can follow. A query with a fixed selection should be
 * written plainly — this is only for the helper that serves several.
 */

/**
 * A selection's row: each SQL fragment's declared type, each column's data or null — the joins
 * that supply most of a list's columns are outer joins.
 */
export type Selected<T extends SelectedFields> = {
	[K in keyof T]: T[K] extends SQL<infer V>
		? V
		: T[K] extends AnyMySqlColumn
			? T[K]['_']['data'] | null
			: never;
};

/** The builder, named by the methods these helpers call on it. */
export type JoinedQuery<R> = PromiseLike<R[]> & {
	innerJoin(table: MySqlTable, on: SQL | undefined): JoinedQuery<R>;
	leftJoin(table: MySqlTable, on: SQL | undefined): JoinedQuery<R>;
	where(condition: SQL | undefined): JoinedQuery<R>;
	orderBy(...columns: (SQL | AnyMySqlColumn)[]): JoinedQuery<R>;
	groupBy(...columns: (SQL | AnyMySqlColumn)[]): JoinedQuery<R>;
	limit(n: number): JoinedQuery<R>;
	offset(n: number): JoinedQuery<R>;
};

/** `db.select(fields).from(table)`, ready for joins, typed by the selection. */
export function joinedSelect<T extends SelectedFields>(
	fields: T,
	table: MySqlTable
): JoinedQuery<Selected<T>> {
	return db.select(fields).from(table).$dynamic() as unknown as JoinedQuery<Selected<T>>;
}
