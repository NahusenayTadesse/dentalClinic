/**
 * Every SQL expression the three target engines do not spell the same way.
 *
 * The rule this exists for is CLAUDE.md §10: the app has to install on MariaDB (cPanel, today),
 * SQLite (a VPS or a clinic's own machine) and Postgres (Vercel), and the way to survive that is
 * for the differences to live in one file rather than at four hundred call sites.
 *
 * Age is the worked example. `TIMESTAMPDIFF(YEAR, hire_date, CURDATE())` is MariaDB; Postgres
 * wants `EXTRACT(YEAR FROM AGE(...))` and SQLite wants arithmetic on `strftime`. Written inline
 * it is a sweep across every screen that shows a length of service, and the one that gets missed
 * returns a wrong number rather than an error — nothing fails, the figures are just wrong.
 * Written as `yearsSince(employee.hireDate)` it is four lines here.
 *
 * **Non-goal: hiding the database.** This is not an abstraction over SQL, and it should never
 * grow a query builder. It holds expressions whose *spelling* differs and nothing else. A query
 * whose *shape* differs between engines cannot be fixed here and belongs in the ledger in
 * `PORTABILITY.md`.
 *
 * Nothing here is portable *yet* — every body below is MariaDB. That is the point: the port is
 * this file, and it is now a file rather than a search.
 */
import { sql, type SQL } from 'drizzle-orm';
import type { MySqlColumn } from 'drizzle-orm/mysql-core';

/** A column or an already-built expression — most of these accept either. */
type Expr = MySqlColumn | SQL;

/** Today, as a date. `CURRENT_DATE` on Postgres, `date('now')` on SQLite. */
export function today(): SQL<string> {
	return sql<string>`CURDATE()`;
}

/** Now, as a datetime. */
export function nowExpr(): SQL<string> {
	return sql<string>`NOW()`;
}

/**
 * Whole years between a past date and today — a length of service, or an age.
 *
 * Whole years, not fractional: "7 years of service" is what a person says, and rounding a
 * fraction would put someone at 8 years two months early.
 */
export function yearsSince(column: Expr): SQL<number> {
	return sql<number>`TIMESTAMPDIFF(YEAR, ${column}, CURDATE())`;
}

/** Whole days from `from` to `to`. Negative when `to` is earlier. */
export function daysBetween(to: Expr, from: Expr): SQL<number> {
	return sql<number>`DATEDIFF(${to}, ${from})`;
}

/**
 * A date as `YYYY-MM-DD`.
 *
 * Formatted in SQL rather than in JS because these values are usually grouped or compared as
 * strings afterwards, and a date that crosses the wire as a `Date` picks up the server's
 * timezone on the way — which is exactly the shift `datetime`-not-`timestamp` exists to avoid.
 */
export function isoDate(column: Expr): SQL<string> {
	return sql<string>`DATE_FORMAT(${column}, '%Y-%m-%d')`;
}

/** A date as `YYYY-MM`, for grouping by month. */
export function monthKey(column: Expr): SQL<string> {
	return sql<string>`DATE_FORMAT(${column}, '%Y-%m')`;
}

/** `column + n days`. */
export function addDays(column: Expr, days: number): SQL<string> {
	return sql<string>`DATE_ADD(${column}, INTERVAL ${days} DAY)`;
}

/**
 * Joins parts with a separator, skipping the nulls.
 *
 * The skipping is the whole reason to use it: plain concatenation returns NULL for the entire
 * result if any part is NULL, so a person with no middle name loses their first name too.
 * SQLite has no `CONCAT_WS` and needs `||` with the nulls coalesced by hand.
 */
export function concatWith(separator: string, ...parts: Expr[]): SQL<string> {
	return sql<string>`CONCAT_WS(${separator}, ${sql.join(parts, sql`, `)})`;
}

/** Every value in a group, joined into one string. `string_agg` on Postgres. */
export function groupConcat(column: Expr, separator = ', '): SQL<string> {
	return sql<string>`GROUP_CONCAT(${column} SEPARATOR ${separator})`;
}

/**
 * `column + n minutes`, where n may itself be a column — an appointment's end is its start plus
 * its duration. `start + (n * interval '1 minute')` on Postgres, `datetime(start, '+' || n || '
 * minutes')` on SQLite.
 */
export function addMinutes(column: Expr, minutes: Expr | number): SQL<string> {
	return sql<string>`DATE_ADD(${column}, INTERVAL ${minutes} MINUTE)`;
}

/**
 * An instant as a `datetime` column stores it, for comparing against an *expression*.
 *
 * Drizzle converts a `Date` to the column's UTC wall clock when the other side of a comparison is a
 * column (`gt(appointment.startsAt, date)`). When the other side is an expression —
 * `addMinutes(startsAt, duration) > date` — there is no column to borrow that mapping from, and the
 * driver serialises the `Date` in the server process's own timezone instead: three hours off in
 * Addis Ababa. The appointment overlap check let a dentist be double-booked because of exactly that.
 */
export function storedInstant(instant: Date): SQL<string> {
	return sql<string>`${instant.toISOString().slice(0, 19).replace('T', ' ')}`;
}
