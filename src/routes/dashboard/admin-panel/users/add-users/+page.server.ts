import { superValidate, message } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { APIError } from 'better-auth/api';
import { eq } from 'drizzle-orm';

import { addUserSchema as schema } from '$lib/ZodSchema';
import { auth } from '$lib/server/auth';
import { db } from '$lib/server/db';
import { roles, user, userStaff } from '$lib/server/db/schema/';
import { notDeleted } from '$lib/server/softDelete';
import { syncAdminRole } from '$lib/server/permissions';
import { officeEmployees as employees } from '$lib/server/fastData';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const [form, officeWorkers, allRoles] = await Promise.all([
		superValidate(zod4(schema)),
		employees(),
		db.select({ value: roles.id, name: roles.name }).from(roles).where(notDeleted(roles))
	]);

	return { form, allRoles, officeWorkers };
};

export const actions: Actions = {
	/**
	 * Creates a staff account through Better Auth, so the password is hashed the same way it
	 * would be at sign-up — there is still only one place in the system that knows how a password
	 * is stored. The public sign-up endpoint is blocked in `hooks.server.ts`; this is the only
	 * route by which an account comes into existence after the first one.
	 */
	addUser: async (event) => {
		const form = await superValidate(event.request, zod4(schema));

		if (!form.valid) {
			return message(
				form,
				{ type: 'error', text: 'Please check the form for Errors' },
				{ status: 400 }
			);
		}

		const { name, email, role, password } = form.data;

		const officeWorkers = await employees();
		const employee = officeWorkers.find((worker) => worker.value === name);

		if (!employee) {
			return message(form, { type: 'error', text: 'Employee Not found' }, { status: 400 });
		}

		// Derived from the employee record rather than typed, so it cannot be chosen.
		const username = employee.name.trim().concat(String(name));

		try {
			const created = await auth.api.createUser({
				body: {
					email,
					password,
					name: employee.name.trim(),
					// The admin plugin's own field. `syncAdminRole` below overwrites it with the
					// value derived from the assigned role — this is only a placeholder so the
					// plugin has something to write.
					role: 'user',
					data: { username, roleId: role }
				},
				headers: event.request.headers
			});

			const userId = created.user.id;

			await db.transaction(async (tx) => {
				// `createUser` does not know about `user_staff`, and a user with no linked employee
				// breaks every page that resolves a signature or a photo through it.
				await tx.insert(userStaff).values({ userId, staffId: name });
				// Belt and braces: `data` above should have set this, but a mismatch here would
				// leave the account with no permissions at all.
				await tx.update(user).set({ roleId: role }).where(eq(user.id, userId));
			});

			await syncAdminRole(userId, role);

			return message(form, { type: 'success', text: 'User Added Successfully' });
		} catch (err) {
			console.error('user create failed', err);

			if (err instanceof APIError) {
				return message(
					form,
					{ type: 'error', text: err.message ?? 'That email address is already in use.' },
					{ status: 409 }
				);
			}

			return message(form, { type: 'error', text: 'Could not create the user' }, { status: 500 });
		}
	}
};
