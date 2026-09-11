import { describe, expect, it } from 'vitest';
import { entityHref, entityPath } from './entityLinks';

describe('entity links', () => {
	it('links a mention when the viewer may open the target', () => {
		// An employee record sits behind `employees.create_followup`.
		expect(entityHref('employee', 42, ['employees.create_followup'])).toBe(
			'/dashboard/employees/single/42'
		);
	});

	it('renders plain text when the viewer may not', () => {
		expect(entityHref('employee', 42, ['reports.hr'])).toBeNull();
		expect(entityHref('employee', 42, [])).toBeNull();
		expect(entityHref('employee', 42, undefined)).toBeNull();
	});

	it('renders plain text when there is no record to point at', () => {
		for (const id of [null, undefined, '']) {
			expect(entityPath('employee', id), String(id)).toBeNull();
			expect(entityHref('employee', id, ['employees.create_followup']), String(id)).toBeNull();
		}
	});

	/*
	 * The registry must not be a second opinion about access. Every path it can produce has to be
	 * one `routeAccess` already governs, or a mention would render as a link to a page that
	 * default-deny then refuses — the exact thing this component exists to prevent.
	 */
	it('points every kind at a route the access rules already govern', () => {
		const kinds = ['employee', 'customer', 'supplier', 'supply', 'user', 'role', 'salary'] as const;

		for (const kind of kinds) {
			const path = entityPath(kind, 1);
			expect(path, kind).not.toBeNull();
			// Some permission opens it: unreachable-for-everyone means the entry is wrong.
			const openable = entityHref(kind, 1, [
				'employees.create_followup',
				'customers.record',
				'supplies_suppliers.manage',
				'users.manage',
				'roles.manage',
				'salary.manage'
			]);
			expect(openable, `${kind} -> ${path} is not opened by any permission`).toBe(path);
		}
	});
});
