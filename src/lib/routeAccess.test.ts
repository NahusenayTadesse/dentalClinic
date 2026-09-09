import { describe, expect, it } from 'vitest';
import { canVisit, permissionForPath, routeRules } from './routeAccess';

describe('route access', () => {
	it('takes the first matching prefix, so a specific rule beats the general one', () => {
		// `/dashboard/reports` sits behind `reports.finance`, but the HR reports have their own.
		expect(permissionForPath('/dashboard/reports/people')).toBe('reports.hr');
		expect(permissionForPath('/dashboard/reports/anything-else')).toBe('reports.finance');

		expect(permissionForPath('/dashboard/admin-panel/users')).toBe('users.manage');
		expect(permissionForPath('/dashboard/admin-panel/regions')).toBe('settings.manage');
	});

	it('leaves an ungated path open to any signed-in user', () => {
		expect(permissionForPath('/dashboard')).toBeUndefined();
		expect(canVisit('/dashboard', [])).toBe(true);
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
		expect(canVisit('/dashboard/salary/bank-history', salary)).toBe(false);
		expect(canVisit('/dashboard/salary/transactions', ['transactions.manage'])).toBe(true);
		expect(canVisit('/dashboard/salary/bank-history', ['bank_history.view'])).toBe(true);
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
