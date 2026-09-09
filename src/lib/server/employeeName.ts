import { sql } from 'drizzle-orm';
import { employee } from '$lib/server/db/schema';

/**
 * An employee's name, assembled in SQL so it can be selected, sorted and searched as one column.
 *
 * Two forms because the app genuinely uses two. Both `COALESCE` every part: `father_name` and
 * `grand_father_name` are nullable, and without it a single NULL makes `CONCAT` return NULL for
 * the whole name rather than the part that is known.
 *
 * These were hand-written in 22 places before they lived here, in four slightly different
 * spellings — one of which omitted the `COALESCE` on `name`.
 */

/** `name father` — the everyday display name, used by lists and pickers. */
export const employeeFullName = sql<string>`TRIM(CONCAT(
	COALESCE(${employee.name}, ''), ' ',
	COALESCE(${employee.fatherName}, '')
))`;

/** `name father grandfather` — the legal form, used by payroll, attendance and reports. */
export const employeeLegalName = sql<string>`TRIM(CONCAT(
	COALESCE(${employee.name}, ''), ' ',
	COALESCE(${employee.fatherName}, ''), ' ',
	COALESCE(${employee.grandFatherName}, '')
))`;
