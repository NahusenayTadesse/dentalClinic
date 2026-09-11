import { error } from '@sveltejs/kit';
import { count, eq } from 'drizzle-orm';
import { message, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { redirect } from 'sveltekit-flash-message/server';

import { auth } from '$lib/server/auth';
import { db } from '$lib/server/db';
import { roles, user } from '$lib/server/db/schema';
import {
	SUPER_ADMIN_ROLE,
	seedAllergens,
	seedAppointmentTypes,
	seedClinicBasics,
	seedContactTypes,
	seedMainBranch,
	seedMedicines,
	seedPermissions,
	seedSpecialties
} from '$lib/server/seedPermissions';
import { setupSchema } from './schema';
import type { Actions, PageServerLoad } from './$types';

/**
 * First-run setup: the one screen that exists because of a chicken-and-egg.
 *
 * `permissions` starts empty, `computeIsSuperAdmin` returns false when it is, user creation
 * lives behind `users.manage`, and there is no public sign-up. So nothing can log in until
 * something creates the first account, and that something cannot itself require a login.
 *
 * It does the permission seeding too rather than leaving it to a script: `$env/dynamic/private`
 * is a SvelteKit virtual module, so anything importing `$lib/server/db` only resolves inside
 * the app. One screen, one step.
 *
 * **What guards it is the user count, and nothing else.** It cannot be permission-gated, so the
 * check is repeated in the action — a stale open tab must not be able to mint a second super
 * admin after setup has completed.
 */
const isFirstRun = async () => {
	const [{ total }] = await db.select({ total: count() }).from(user);
	return total === 0;
};

export const load: PageServerLoad = async () => {
	if (!(await isFirstRun())) {
		throw redirect(302, '/login');
	}

	return { form: await superValidate(zod4(setupSchema)) };
};

export const actions: Actions = {
	default: async (event) => {
		if (!(await isFirstRun())) {
			throw error(403, 'Setup has already been completed.');
		}

		const form = await superValidate(event.request, zod4(setupSchema));

		if (!form.valid) {
			return message(
				form,
				{ type: 'error', text: 'Please check the form for errors' },
				{ status: 400 }
			);
		}

		try {
			// Both idempotent, and both ordered before the account: `user.roleId` is notNull so
			// the role must exist, and `user.branchId` defaults to the main branch so that row
			// must exist too or the foreign key rejects the insert.
			await seedPermissions();
			await seedMainBranch();
			await seedContactTypes();
			await seedAllergens();
			await seedClinicBasics();
			await seedSpecialties();
			await seedAppointmentTypes();
			await seedMedicines();

			const [role] = await db
				.select({ id: roles.id })
				.from(roles)
				.where(eq(roles.name, SUPER_ADMIN_ROLE))
				.limit(1);

			if (!role) {
				return message(
					form,
					{ type: 'error', text: 'Could not create the administrator role.' },
					{ status: 500 }
				);
			}

			/*
			 * Through better-auth, so the password is hashed exactly as any later one would be
			 * and lands in `account` where sign-in looks for it. `roleId` rides along because it
			 * is declared an input `additionalField` in the auth config.
			 */
			await auth.api.signUpEmail({
				body: {
					name: form.data.name,
					email: form.data.email,
					password: form.data.password,
					roleId: role.id
				},
				headers: event.request.headers,
				asResponse: false
			});

			/*
			 * `role: 'admin'` is a second, independent gate — better-auth's admin plugin checks
			 * it for createUser/banUser/impersonate, and it is unrelated to `roleId`, which is
			 * what `permList` and every route rule are derived from. Setting only one leaves a
			 * confusingly half-locked-out account, so the first admin gets both.
			 */
			await db
				.update(user)
				.set({ role: 'admin', emailVerified: true })
				.where(eq(user.email, form.data.email));
		} catch (err) {
			console.error('setup failed', err);

			return message(
				form,
				{ type: 'error', text: 'Setup could not be completed. Check the server log.' },
				{ status: 500 }
			);
		}

		throw redirect(
			'/login',
			{ type: 'success', message: 'Setup complete. Sign in with your new account.' },
			event.cookies
		);
	}
};
