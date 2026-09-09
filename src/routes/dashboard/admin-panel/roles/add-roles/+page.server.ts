import { message, setError, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';

import { createRoleSchema as schema } from './schema';
import { db } from '$lib/server/db';
import { permissions, rolePermissions, roles } from '$lib/server/db/schema/';
import type { PageServerLoad, Actions } from './$types.js';

export const load: PageServerLoad = async () => {
	const form = await superValidate(zod4(schema));

	return {
		form
	};
};

export const actions: Actions = {
	add: async ({ request }) => {
		const form = await superValidate(request, zod4(schema));

		if (!form.valid) {
			return message(form, { type: 'error', text: 'Please check the form for Errors' });
		}

		const { name, description, permissions } = form.data;

		try {
			const [role] = await db.insert(roles).values({ name, description }).$returningId();

			await db.insert(rolePermissions).values(
				permissions.map((permId) => ({
					roleId: role.id,
					permissionId: Number(permId)
				}))
			);

			return message(form, { type: 'success', text: 'Role added successfully.' });
		} catch (err: any) {
			if (err.code === 'ER_DUP_ENTRY') return setError(form, 'name', 'Role Name already exists.');

			return message(form, {
				type: 'error',
				text:
					err.code === 'ER_DUP_ENTRY'
						? 'Role Name is already taken. Please choose another one.'
						: err.message
			});
		}
	}
} satisfies Actions;
