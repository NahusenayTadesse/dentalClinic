import { readdirSync, readFileSync } from 'node:fs';
import { join, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Guards the rule that a new screen ships with its help (CLAUDE.md §13).
 *
 * Help has three surfaces and this checks the two that are route-shaped: the `?` panel
 * (`$lib/content/*.json`, resolved by `$lib/Registry.ts`) and the route map in
 * `$lib/help/content.ts`. `HELP_SECTIONS` is organised by *topic* rather than by route — "how do
 * I run payroll" spans four pages — so it is deliberately not checked here. Forcing a topic per
 * route would turn a manual written for clinic staff into a page-by-page index nobody reads.
 *
 * **Why "does help resolve?" is the wrong question.** `resolveHelp` falls back to the longest
 * substring `match`, so before this test existed every page in the app resolved to *something*
 * and coverage looked perfect. It was not: all 28 admin-panel screens — allergens, dental labs,
 * tax types, pensions — resolved to one generic "Admin Panel" entry describing the ERP this
 * system was repurposed from. Wrong help is worse than none, because an empty panel is honest.
 * So the question here is whether a page has help *of its own*.
 *
 * Four lists below. `HELP_FAMILY` is a decision; the three backlogs are debts. **A backlog may
 * only shrink** — the same ratchet `scripts/check-budget.mjs` applies to type and lint counts,
 * and for the same reason: a number that can go up is not a budget. Each backlog is also checked
 * for entries that are no longer true, so a debt cannot be paid and left on the books.
 */

const ROUTES_ROOT = join(process.cwd(), 'src', 'routes');
const CONTENT_DIR = join(process.cwd(), 'src', 'lib', 'content');

/**
 * Pages that deliberately share an ancestor's help, because they are views *of* that screen
 * rather than screens of their own — an employee's salary tab is part of the employee page.
 *
 * This is an allowlist and not an inference on purpose. "Covered by an ancestor" describes the
 * legitimate case and the admin-panel bug equally well, and no rule about path depth separates
 * them: `/dashboard/approvals/[entity]` and `/dashboard/admin-panel/allergens` sit the same
 * distance below their entry. Only a person can say which is a view and which is a screen, so a
 * person says it, here.
 */
const HELP_FAMILY = new Set([
	'/dashboard/admin-panel/roles/[id]',
	'/dashboard/admin-panel/roles/add-roles',
	'/dashboard/admin-panel/users/[id]',
	'/dashboard/admin-panel/users/add-users',
	'/dashboard/approvals/[entity]',
	'/dashboard/customers/[id]',
	'/dashboard/employees/attendance/[range]',
	'/dashboard/employees/leaves/approved',
	'/dashboard/employees/leaves/cancelled',
	'/dashboard/employees/leaves/pending',
	'/dashboard/employees/single/[id]',
	'/dashboard/employees/single/[id]/add-leave',
	'/dashboard/employees/single/[id]/id-maker',
	'/dashboard/employees/single/[id]/leave-history',
	'/dashboard/employees/single/[id]/salary',
	'/dashboard/employees/single/[id]/salary/add-bonus',
	'/dashboard/employees/single/[id]/salary/add-deduction',
	'/dashboard/employees/single/[id]/salary/add-overtime',
	'/dashboard/employees/single/[id]/salary/change-salary',
	'/dashboard/employees/single/[id]/salary/salary-history',
	'/dashboard/rejections/[entity]',
	'/dashboard/salary/add-deductions/[range]',
	'/dashboard/salary/add-overtime/[range]',
	'/dashboard/salary/add-payroll/[range]',
	'/dashboard/salary/paid-salaries/[month_year]',
	'/dashboard/salary/paid-salaries/adjust/[id]',
	'/dashboard/salary/single/[id]',
	'/dashboard/salary/transactions/expenses',
	'/dashboard/salary/transactions/expenses/add-expense',
	'/dashboard/salary/transactions/expenses/categories',
	'/dashboard/salary/transactions/expenses/ranges/[range]',
	'/dashboard/salary/transactions/ranges/[range]',
	'/dashboard/supplies/[id]',
	'/dashboard/supplies/[id]/damaged/[range]',
	'/dashboard/supplies/[id]/ranges/[range]',
	'/dashboard/supplies/suppliers/[id]',
	'/dashboard/supplies/suppliers/add-suppliers'
]);

/**
 * Screens with no help of their own, all of them admin-panel lookups currently answered by the
 * generic "Admin Panel" entry. Thirteen are already migrated onto `LookupPage`, so this list and
 * the lookup migration burn down together.
 */
const HELP_BACKLOG = new Set([
	'/dashboard/admin-panel/allergens',
	'/dashboard/admin-panel/annual-leave-entitlements',
	'/dashboard/admin-panel/appointment-types',
	'/dashboard/admin-panel/branches',
	'/dashboard/admin-panel/cities',
	'/dashboard/admin-panel/closures',
	'/dashboard/admin-panel/conditions',
	'/dashboard/admin-panel/contact-types',
	'/dashboard/admin-panel/dental-labs',
	'/dashboard/admin-panel/department',
	'/dashboard/admin-panel/educational-level',
	'/dashboard/admin-panel/employment-status',
	'/dashboard/admin-panel/leave-accrual',
	'/dashboard/admin-panel/leave-expiry-policy',
	'/dashboard/admin-panel/leave-types',
	'/dashboard/admin-panel/overtime-types',
	'/dashboard/admin-panel/payment-methods',
	'/dashboard/admin-panel/pensions',
	'/dashboard/admin-panel/positions',
	'/dashboard/admin-panel/referral-sources',
	'/dashboard/admin-panel/regions',
	'/dashboard/admin-panel/services',
	'/dashboard/admin-panel/services/categories',
	'/dashboard/admin-panel/specialties',
	'/dashboard/admin-panel/subcities',
	'/dashboard/admin-panel/supply-types',
	'/dashboard/admin-panel/tax-types',
	'/dashboard/admin-panel/vat-withhold'
]);

/**
 * Help files describing pages that no longer exist — mostly the client-billing features that were
 * pruned (contracts, payments, requests, sites) and the supply leases removed this cycle.
 *
 * Drift runs both ways, and only this direction leaves the manual confidently describing a system
 * nobody can find. Deleting these is content work, not test work, so they are recorded rather
 * than silently tolerated.
 */
const ORPHAN_BACKLOG = new Set([
	'add-contract.json',
	'add-payment.json',
	'add-request.json',
	'add-site.json',
	'bank-history.json',
	'contract-details.json',
	'contracts-inactive.json',
	'contracts-list.json',
	'contracts-terminated.json',
	'employees-by-site.json',
	'payments-list.json',
	'report-commercial.json',
	'requests-section.json',
	'site-detail.json',
	'sites-list.json',
	'supply-leases.json'
]);

/** Pages absent from `ROUTE_MAP`, so the route map and printed manual do not list them. */
const ROUTE_MAP_BACKLOG = new Set([
	'/dashboard/admin-panel/allergens',
	'/dashboard/admin-panel/appointment-types',
	'/dashboard/admin-panel/closures',
	'/dashboard/admin-panel/conditions',
	'/dashboard/admin-panel/contact-types',
	'/dashboard/admin-panel/dental-labs',
	'/dashboard/admin-panel/referral-sources',
	'/dashboard/admin-panel/roles/[id]',
	'/dashboard/admin-panel/roles/add-roles',
	'/dashboard/admin-panel/services/categories',
	'/dashboard/admin-panel/specialties',
	'/dashboard/admin-panel/users/[id]',
	'/dashboard/admin-panel/users/add-users',
	'/dashboard/employees/leaves/approved',
	'/dashboard/employees/leaves/cancelled',
	'/dashboard/employees/leaves/pending',
	'/dashboard/employees/single/[id]/salary/add-bonus',
	'/dashboard/employees/single/[id]/salary/add-deduction',
	'/dashboard/employees/single/[id]/salary/add-overtime',
	'/dashboard/salary',
	'/dashboard/salary/transactions/expenses/ranges/[range]',
	'/dashboard/salary/transactions/ranges/[range]',
	'/dashboard/supplies/[id]/ranges/[range]',
	'/dashboard/supplies/suppliers/[id]'
]);

type Entry = { key: string; file: string; exact: boolean };

function dashboardPages(): string[] {
	function walk(dir: string): string[] {
		const found: string[] = [];

		for (const entry of readdirSync(dir, { withFileTypes: true })) {
			const full = join(dir, entry.name);

			if (entry.isDirectory()) found.push(...walk(full));
			else if (entry.name === '+page.svelte') {
				found.push(dir.slice(ROUTES_ROOT.length).split(sep).join('/') || '/');
			}
		}

		return found;
	}

	return [...new Set(walk(join(ROUTES_ROOT, 'dashboard')))].sort();
}

/** Every `?`-panel entry, keyed the way `Registry.ts` keys it. */
function helpEntries(): Entry[] {
	return readdirSync(CONTENT_DIR)
		.filter((file) => file.endsWith('.json'))
		.map((file) => {
			const json = JSON.parse(readFileSync(join(CONTENT_DIR, file), 'utf8'));
			const raw: string = json.path ?? json.match ?? '';

			return { key: raw.replace(/\/$/, ''), file, exact: Boolean(json.path) };
		});
}

function routeMapPaths(): Set<string> {
	const source = readFileSync(join(process.cwd(), 'src', 'lib', 'help', 'content.ts'), 'utf8');

	return new Set([...source.matchAll(/^\t\tpath: '([^']+)'/gm)].map((m) => m[1]));
}

const pages = dashboardPages();
const entries = helpEntries();
const ownEntry = new Set(entries.map((e) => e.key));

/**
 * An entry nothing can reach: no page contains its key.
 *
 * `includes` rather than equality or a prefix test, because that is what `resolveHelp` does — an
 * entry is reachable exactly when some real page would resolve to it.
 */
function isOrphan(entry: Entry): boolean {
	return !pages.some((p) => p.includes(entry.key));
}

/** Mirrors `resolveHelp`: an exact path first, then the longest substring match. */
function resolves(pathname: string): Entry | undefined {
	const exact = entries.find((e) => e.exact && e.key === pathname);
	if (exact) return exact;

	return entries
		.filter((e) => !e.exact)
		.sort((a, b) => b.key.length - a.key.length)
		.find((e) => pathname.includes(e.key));
}

describe('help coverage', () => {
	it('gives every dashboard page help of its own', () => {
		const missing = pages.filter(
			(p) => !ownEntry.has(p) && !HELP_FAMILY.has(p) && !HELP_BACKLOG.has(p)
		);

		expect(
			missing,
			`add a $lib/content entry for:\n  ${missing.join('\n  ')}\n\n` +
				`If the page is a view of its parent rather than a screen of its own, add it to ` +
				`HELP_FAMILY instead and say so.`
		).toEqual([]);
	});

	it('lists every dashboard page in the route map', () => {
		const inMap = routeMapPaths();
		const missing = pages.filter((p) => !inMap.has(p) && !ROUTE_MAP_BACKLOG.has(p));

		expect(
			missing,
			`add a ROUTE_MAP entry in help/content.ts for:\n  ${missing.join('\n  ')}`
		).toEqual([]);
	});

	it('keeps no help for a page that does not exist', () => {
		const orphans = entries
			.filter(isOrphan)
			.map((e) => e.file)
			.filter((file) => !ORPHAN_BACKLOG.has(file));

		expect(orphans, `these describe pages that were deleted:\n  ${orphans.join('\n  ')}`).toEqual(
			[]
		);
	});

	/*
	 * The ratchet. Without these three, a backlog is a list of excuses that outlives the problem:
	 * the debt gets paid, the entry stays, and the next person reads it as permission.
	 */
	it('holds no backlog entry that has already been paid off', () => {
		const paidHelp = [...HELP_BACKLOG].filter((p) => ownEntry.has(p) || !pages.includes(p));
		const paidMap = [...ROUTE_MAP_BACKLOG].filter(
			(p) => routeMapPaths().has(p) || !pages.includes(p)
		);
		const stillOrphaned = new Set(entries.filter(isOrphan).map((e) => e.file));
		// Paid off by deleting the file, or by the page it describes coming back.
		const paidOrphans = [...ORPHAN_BACKLOG].filter((f) => !stillOrphaned.has(f));

		expect(paidHelp, `remove from HELP_BACKLOG:\n  ${paidHelp.join('\n  ')}`).toEqual([]);
		expect(paidMap, `remove from ROUTE_MAP_BACKLOG:\n  ${paidMap.join('\n  ')}`).toEqual([]);
		expect(paidOrphans, `remove from ORPHAN_BACKLOG:\n  ${paidOrphans.join('\n  ')}`).toEqual([]);
	});

	it('keeps every HELP_FAMILY page actually served by an ancestor', () => {
		// A family page that resolves to nothing, or to its own entry, means the list is stale.
		const wrong = [...HELP_FAMILY].filter((p) => {
			if (!pages.includes(p)) return false; // page deleted — the backlog test covers that
			const hit = resolves(p);
			return !hit || hit.key === p;
		});

		expect(
			wrong,
			`these are not covered by an ancestor any more:\n  ${wrong.join('\n  ')}`
		).toEqual([]);
	});
});
