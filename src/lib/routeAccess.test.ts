import { readdirSync } from 'node:fs';
import { join, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import { canVisit, permissionForPath, ruleForPath, routeRules } from './routeAccess';

describe('route access', () => {
	it('takes the first matching prefix, so a specific rule beats the general one', () => {
		// `/dashboard/reports` sits behind `reports.finance`, but the HR reports have their own.
		expect(permissionForPath('/dashboard/reports/people')).toBe('reports.hr');
		expect(permissionForPath('/dashboard/reports/anything-else')).toBe('reports.finance');

		expect(permissionForPath('/dashboard/admin-panel/users')).toBe('users.manage');
		expect(permissionForPath('/dashboard/admin-panel/regions')).toBe('settings.manage');
	});

	it('opens the four ungated pages to any signed-in user', () => {
		// Declared with `permission: null` — a decision, not an absence of one.
		for (const path of [
			'/dashboard',
			'/dashboard/change-password',
			'/dashboard/help',
			'/dashboard/files/a1b2c3.jpg'
		]) {
			expect(permissionForPath(path), path).toBeUndefined();
			expect(canVisit(path, []), path).toBe(true);
		}
	});

	/*
	 * The rule that used to be missing. `canVisit` returned true for anything no prefix claimed,
	 * so every page added without a `routeRules` entry — 96 pages against 22 rules — was readable
	 * by any account, and nothing reported it.
	 */
	it('refuses a dashboard path that no rule claims', () => {
		expect(ruleForPath('/dashboard/patients')).toBeUndefined();
		expect(canVisit('/dashboard/patients', [])).toBe(false);
		// Not even a super-admin's worth of permissions opens a page with no rule.
		expect(canVisit('/dashboard/patients', ['settings.manage', 'users.manage'])).toBe(false);
	});

	it('keeps the /dashboard rule exact, or it would reopen everything', () => {
		// As a prefix rule, `{ prefix: '/dashboard', permission: null }` matches every page in the
		// app and hands default-deny straight back to default-allow.
		expect(canVisit('/dashboard/', [])).toBe(true);
		expect(canVisit('/dashboard/backup', [])).toBe(false);
	});

	it('does not gate anything outside /dashboard', () => {
		for (const path of ['/login', '/setup', '/forgot-password', '/']) {
			expect(canVisit(path, []), path).toBe(true);
		}
	});

	it('holds a backup behind the settings permission', () => {
		expect(canVisit('/dashboard/backup', ['settings.manage'])).toBe(true);
		expect(canVisit('/dashboard/backup', ['employees.create_followup'])).toBe(false);
		expect(canVisit('/dashboard/backup', undefined)).toBe(false);
	});

	it('keeps approvals and rejections independent of each other', () => {
		expect(canVisit('/dashboard/rejections', ['approvals.view'])).toBe(false);
		expect(canVisit('/dashboard/approvals', ['rejections.view'])).toBe(false);
		expect(canVisit('/dashboard/rejections/employees', ['rejections.view'])).toBe(true);
	});

	it('hides the cross-section menu entries a user cannot reach', () => {
		// The supplies menu links at the admin panel for supply types.
		const supplies = ['supplies_suppliers.manage'];
		expect(canVisit('/dashboard/supplies', supplies)).toBe(true);
		expect(canVisit('/dashboard/admin-panel/supply-types', supplies)).toBe(false);

		// The employees menu spans three permissions.
		const employees = ['employees.create_followup'];
		expect(canVisit('/dashboard/employees/add-employee', employees)).toBe(true);
		expect(canVisit('/dashboard/employees/attendance', employees)).toBe(false);
		expect(canVisit('/dashboard/employees/leaves', employees)).toBe(false);
	});

	it('every rule names a dashboard prefix, so nothing gates the login pages by accident', () => {
		for (const rule of routeRules) {
			expect(rule.prefix.startsWith('/dashboard'), rule.prefix).toBe(true);
		}
	});

	/*
	 * The test that keeps default-deny honest.
	 *
	 * Refusing an unclaimed path makes a missing rule *visible*, but only to whoever clicks it.
	 * This makes it visible to whoever adds the page, which is the person who can still cheaply
	 * fix it. A new route under `/dashboard` fails here until it is either given a permission or
	 * declared `permission: null` on purpose.
	 */
	it('has a rule for every page under /dashboard', () => {
		const root = join(process.cwd(), 'src', 'routes', 'dashboard');

		function pagePaths(dir: string): string[] {
			const found: string[] = [];

			for (const entry of readdirSync(dir, { withFileTypes: true })) {
				const full = join(dir, entry.name);

				if (entry.isDirectory()) {
					found.push(...pagePaths(full));
				} else if (entry.name === '+page.svelte' || entry.name === '+server.ts') {
					// `src/routes/dashboard/foo/+page.svelte` -> `/dashboard/foo`
					const url = dir
						.slice(join(process.cwd(), 'src', 'routes').length)
						.split(sep)
						.join('/');
					found.push(url === '' ? '/' : url);
				}
			}

			return found;
		}

		const uncovered = [...new Set(pagePaths(root))].filter((path) => !ruleForPath(path));

		expect(uncovered, `add a routeRules entry for:\n  ${uncovered.join('\n  ')}`).toEqual([]);
	});

	it('gives each report page the permission its content answers to', () => {
		const hr = ['reports.hr'];
		expect(canVisit('/dashboard/reports/people', hr)).toBe(true);
		expect(canVisit('/dashboard/reports/leave', hr)).toBe(true);
		expect(canVisit('/dashboard/reports/money', hr)).toBe(false);
		// The overview aggregates the finance figures, so HR alone does not open it.
		expect(canVisit('/dashboard/reports', hr)).toBe(false);

		expect(canVisit('/dashboard/reports/system', ['audit_logs.view'])).toBe(true);
		expect(canVisit('/dashboard/reports/system', ['reports.finance'])).toBe(false);
	});

	it('separates seeing the approval queues from settling them', () => {
		const viewer = ['approvals.view'];
		expect(canVisit('/dashboard/approvals', viewer)).toBe(true);
		expect(canVisit('/dashboard/approvals/employees', viewer)).toBe(false);
		expect(canVisit('/dashboard/approvals/employees', ['approvals.approve'])).toBe(true);
	});

	it('gates the salary pages that carry a permission of their own', () => {
		const salary = ['salary.manage'];
		expect(canVisit('/dashboard/salary/add-payroll', salary)).toBe(true);
		expect(canVisit('/dashboard/salary/transactions', salary)).toBe(false);
		expect(canVisit('/dashboard/salary/transactions', ['transactions.manage'])).toBe(true);
	});

	/*
	 * Replaced a version that named four request/payment routes. Those pages went with the
	 * client-billing prune, and a test that asserts about deleted routes passes for the wrong
	 * reason. This checks the invariant they were really there to protect: every area holding
	 * personal or financial data refuses a caller with no permissions at all.
	 */
	it('leaves no data-bearing area open to a caller with no permissions', () => {
		const gated = [
			'/dashboard/customers',
			'/dashboard/employees',
			'/dashboard/employees/leaves',
			'/dashboard/salary',
			'/dashboard/supplies',
			'/dashboard/admin-panel',
			'/dashboard/backup',
			'/dashboard/approvals',
			'/dashboard/rejections'
		];

		for (const path of gated) {
			expect(canVisit(path, []), path).toBe(false);
		}
	});
});
