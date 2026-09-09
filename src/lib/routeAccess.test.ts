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

		expect(canVisit('/dashboard/reports/commercial', ['reports.customer_site'])).toBe(true);
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

	it('covers the pages that had a sidebar permission but no gate at all', () => {
		expect(canVisit('/dashboard/requests/pending', [])).toBe(false);
		expect(canVisit('/dashboard/requests/special', [])).toBe(false);
		expect(canVisit('/dashboard/payments/approved', [])).toBe(false);
		expect(canVisit('/dashboard/payments/approved', ['payments.follow_up'])).toBe(true);
	});
});
