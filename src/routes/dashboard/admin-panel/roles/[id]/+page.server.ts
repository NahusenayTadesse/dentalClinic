import { message, superValidate, setError } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { editRoleSchema as schema } from './schema';

import { db } from '$lib/server/db';
import { roles, user, permissions, rolePermissions, session } from '$lib/server/db/schema';
import { eq, countDistinct, and } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';
import { fail } from 'sveltekit-superforms';
import { setFlash, redirect } from 'sveltekit-flash-message/server';
import { notDeleted, softDeleteRole, usersOnRole } from '$lib/server/softDelete';
import { requireSuperAdmin } from '$lib/server/permissions';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params }) => {
	const { id } = params;

	const form = await superValidate(zod4(schema));

	const singleUser = await db
		.select({
			id: roles.id,
			name: roles.name,
			description: roles.description,
			userCount: countDistinct(user.id),
			permissionsCount: countDistinct(rolePermissions.id)
		})
		.from(roles)
		.leftJoin(
			user,
			and(
				eq(user.roleId, roles.id),
				eq(user.isActive, true), // Filter happens DURING the join
				notDeleted(user)
			)
		)
		.leftJoin(
			rolePermissions,
			and(eq(rolePermissions.roleId, roles.id), notDeleted(rolePermissions))
		)
		.groupBy(roles.id)
		.where(and(eq(roles.id, id), notDeleted(roles)))
		.then((rows) => rows[0]);

	if (!singleUser) {
		return error(404, { message: 'Role not found' });
	}

	const permissionList = await db
		.select({
			id: permissions.id,
			name: permissions.name,
			description: permissions.description
		})
		.from(permissions)
		.innerJoin(
			rolePermissions,
			and(eq(permissions.id, rolePermissions.permissionId), notDeleted(rolePermissions))
		)
		.where(eq(rolePermissions.roleId, id));

	const allPerms = await db
		.select({
			value: permissions.id,
			name: permissions.description,
			description: permissions.name
		})
		.from(permissions)
		.orderBy(permissions.name);

	const userList = await db
		.select({
			id: user.id,
			email: user.email,
			name: user.name,
			isActive: user.isActive
		})
		.from(user)
		.where(and(eq(user.roleId, id), notDeleted(user)));

	return {
		singleUser,
		id,
		form,
		userList,
		allPerms,

		permissionList
	};
};

// import { saveUploadedFile } from '$lib/server/upload';

export const actions: Actions = {
	edit: async ({ request, params }) => {
		const { id } = params;
		const form = await superValidate(request, zod4(schema));

		if (!form.valid) {
			return message(form, { type: 'error', text: 'Please check the form for Errors' });
		}

		const { name, description, permissions } = form.data;

		try {
			await db
				.update(roles)
				.set({ name, description })
				.where(eq(roles.id, Number(id)));

			await db.delete(rolePermissions).where(eq(rolePermissions.roleId, Number(id)));

			await db.insert(rolePermissions).values(
				permissions.map((permId) => ({
					roleId: Number(id),
					permissionId: Number(permId)
				}))
			);

			return message(form, { type: 'success', text: 'Role updated successfully.' });
		} catch (err: any) {
			if (err.code === 'ER_DUP_ENTRY')
				return setError(form, 'name', 'Role updated already exists.');

			return message(form, {
				type: 'error',
				text:
					err.code === 'ER_DUP_ENTRY'
						? 'Role Name is already taken. Please choose another one.'
						: err.message
			});
		}
	},
	/**
	 * Soft delete. Super admin only — `requireSuperAdmin` throws 403 rather than
	 * failing quietly, because the hidden button is UX, not access control.
	 *
	 * This used to be a `db.delete(roles)` with no permission check, which the
	 * `user.role_id` foreign key would have refused anyway while anyone held the
	 * role. The count below turns that into a message the user can act on.
	 */
	delete: async ({ params, locals, cookies }) => {
		requireSuperAdmin(locals);
		const { id } = params;

		try {
			const holders = await usersOnRole(Number(id));
			if (holders > 0) {
				setFlash(
					{
						type: 'error',
						message: `${holders} user${holders === 1 ? ' is' : 's are'} still on this role. Move them to another role first.`
					},
					cookies
				);
				return fail(409);
			}

			await db.transaction(async (tx) => {
				await softDeleteRole(tx, Number(id), locals.user?.id);
			});
		} catch (err) {
			console.error('Error deleting role:', err);
			setFlash(
				{
					type: 'error',
					message: `Could not delete role: ${err instanceof Error ? err.message : 'Unknown error'}`
				},
				cookies
			);
			return fail(500);
		}

		redirect(
			'/dashboard/admin-panel/roles',
			{ type: 'success', message: 'Role and its permission grants deleted.' },
			cookies
		);
	}
} satisfies Actions;
