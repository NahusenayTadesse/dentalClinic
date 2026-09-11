/**
 * Where each kind of record lives, and whether this viewer may open it.
 *
 * **The app should read like the database reads.** A provider named on a patient's chart, a
 * supplier named on a delivery, an employee named on a payroll line — each of those is a foreign
 * key, and a foreign key the person cannot follow is a dead end they have to navigate around by
 * hand. Every mention of a record that has a page of its own should be a way to get to it.
 *
 * **With one condition: a link the viewer cannot open is worse than no link.** It advertises a
 * page, and clicking it now lands on a 403 (CLAUDE.md §9 — `/dashboard` is closed by default).
 * So the name is a link when the viewer may open the target and plain text when they may not,
 * which also means the table quietly stops telling a receptionist that an employee's salary page
 * exists.
 *
 * **One registry, one check, so the app is not sprayed with permission tests.** The check is
 * `canVisit`, which is already the single source of truth for route access — this file adds no
 * second opinion about who may see what. It only says where each kind of record lives, so that
 * `entity: 'employee'` in a column definition is enough and no caller has to know the URL or
 * name a permission.
 *
 * Not under `$lib/server`: the decision is made where the cell renders, which is the browser as
 * well as the server. It is safe there because it decides *rendering* only — the control is the
 * route gate in `hooks.server.ts`, which does not trust this or anything else from the client.
 *
 * Adding a kind is one line here. A kind whose page does not exist yet does not belong here yet:
 * an entry pointing at a route that has no `routeRules` rule resolves to plain text anyway, and
 * `routeAccess.test.ts` is what catches the missing rule.
 */
import { canVisit } from './routeAccess';

/** The kinds of record that have a page of their own. */
export type EntityKind =
	| 'employee'
	| 'customer'
	| 'supplier'
	| 'supply'
	| 'user'
	| 'role'
	| 'salary';

/**
 * Base path per kind. The record's id is appended.
 *
 * These are the *existing* detail pages. Patients, providers, invoices and appointments join the
 * list as their pages are built — the schema has the tables, the routes are the app phase.
 */
const ENTITY_ROUTES: Record<EntityKind, string> = {
	employee: '/dashboard/employees/single',
	customer: '/dashboard/customers',
	supplier: '/dashboard/supplies/suppliers',
	supply: '/dashboard/supplies',
	user: '/dashboard/admin-panel/users',
	role: '/dashboard/admin-panel/roles',
	salary: '/dashboard/salary/single'
};

/** The path to one record's page, or null when there is no id to point at. */
export function entityPath(
	kind: EntityKind,
	id: string | number | null | undefined
): string | null {
	if (id === null || id === undefined || id === '') return null;

	return `${ENTITY_ROUTES[kind]}/${id}`;
}

/**
 * The href to render for this mention, or `null` to render the name as plain text.
 *
 * Null covers both reasons a mention is not a link — there is no record to point at, and the
 * viewer may not open it — because the caller does the same thing in both cases.
 */
export function entityHref(
	kind: EntityKind,
	id: string | number | null | undefined,
	permList: string[] | undefined | null
): string | null {
	const path = entityPath(kind, id);
	if (!path) return null;

	return canVisit(path, permList) ? path : null;
}
