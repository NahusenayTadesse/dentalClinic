import { message, setError, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { editUserSchema as schema } from './schema';

import { db } from '$lib/server/db';
import {
	roles,
	user,
	permissions,
	session,
	rolePermissions,
	specialPermissions as userPermissions,
	userStaff
} from '$lib/server/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { notDeleted, softDeleteUser } from '$lib/server/softDelete';
import { requireSuperAdmin, syncAdminRole } from '$lib/server/permissions';
import { setFlash, redirect } from 'sveltekit-flash-message/server';
import type { Actions, PageServerLoad } from './$types';
import { fail } from 'sveltekit-superforms';
export const load: PageServerLoad = async ({ params }) => {
	const { id } = params;

	const form = await superValidate(zod4(schema));

	const singleUser = await db
		.select({
			id: user.id,
			name: user.name,
			email: user.email,
			roleId: user.roleId,
			role: roles.name,
			employeeId: userStaff.staffId,
			status: user.isActive,
			createdAt: user.createdAt,
			updatedAt: user.updatedAt
		})
		.from(user)
		.leftJoin(roles, and(eq(user.roleId, roles.id), notDeleted(roles)))
		.leftJoin(userStaff, eq(user.id, userStaff.userId))
		.where(and(eq(user.id, id), notDeleted(user)))
		.then((rows) => rows[0]);

	if (!singleUser) {
		return fail(404, { message: 'User not found' });
	}

	const roleList = await db
		.select({
			value: roles.id,
			name: roles.name
		})
		.from(roles)
		.where(notDeleted(roles));

	const rolePermissionList = await db
		.select({
			value: permissions.id,
			name: permissions.description,
			description: permissions.name
		})
		.from(permissions)
		.innerJoin(
			rolePermissions,
			and(eq(permissions.id, rolePermissions.permissionId), notDeleted(rolePermissions))
		)
		.where(eq(rolePermissions.roleId, singleUser.roleId));

	const userPermissionsList = await db
		.select({
			value: permissions.id,
			name: permissions.description,
			description: permissions.name
		})
		.from(permissions)
		.innerJoin(
			userPermissions,
			and(eq(permissions.id, userPermissions.permissionId), notDeleted(userPermissions))
		)
		.where(eq(userPermissions.userId, id));

	let permissionList;
	if (userPermissionsList.length > 0) {
		permissionList = userPermissionsList;
	} else {
		permissionList = rolePermissionList;
	}

	const allPerms = await db
		.select({
			value: permissions.id,
			name: permissions.description,
			description: permissions.name
		})
		.from(permissions)
		.orderBy(permissions.name);

	return {
		singleUser,
		id,
		form,
		roleList,
		permissionList,
		allPerms
	};
};

// import { saveUploadedFile } from '$lib/server/upload';

export const actions: Actions = {
	editUser: async ({ request, params }) => {
		const form = await superValidate(request, zod4(schema));
		console.log(form.data);

		const { id } = params;

		if (!form.valid) {
			// Stay on the same page and set a flash message
			return message(form, { type: 'error', text: 'Please check your form data.' });
		}

		const { name, email, role, permissionsList, editPermission } = form.data;

		try {
			await db.transaction(async (tx) => {
				// Client-side (to sync the changes)

				await tx
					.update(user)
					.set({
						name,
						email,
						roleId: role
					})
					.where(eq(user.id, id));

				// 2. Wipe existing permissions

				if (editPermission) {
					// 3. Insert new permissions (using 'tx', not 'db')
					if (permissionsList.length > 0) {
						await tx.delete(userPermissions).where(eq(userPermissions.userId, id));
						await tx.insert(userPermissions).values(
							permissionsList.map((permId) => ({
								userId: id,
								permissionId: permId
							}))
						);
					} else {
						setError(form, 'permissionsList', 'Permission cannot be empty');
						return message(
							form,
							{ type: 'error', text: 'Permission cannot be empty' },
							{ status: 400 }
						);
					}
				}

				// A role or permission change has to bite on the next request, not whenever the
				// cookie happens to expire, so every session this user holds is ended here.
				await tx.delete(session).where(eq(session.userId, id));
			});

			// `roleId` just changed, so the admin plugin's own `user.role` has to follow it.
			// See `syncAdminRole` for why the two are kept in step rather than set by hand.
			await syncAdminRole(id, role);

			// Stay on the same page and set a flash message
			return message(form, { type: 'success', text: 'User Updated Successfully' });
		} catch (err) {
			console.error('User Update Failed', err);
			const text = err instanceof Error ? err.message : 'User Update Failed';
			return message(form, { type: 'error', text });
		}
	},

	/**
	 * Soft delete. Super admin only — `requireSuperAdmin` throws 403 rather than
	 * failing quietly, because the hidden button is UX, not access control.
	 *
	 * Deleting yourself is refused: it would end your own session mid-request and
	 * could leave the system with no super admin at all.
	 */
	delete: async ({ cookies, params, locals }) => {
		requireSuperAdmin(locals);
		const { id } = params;

		if (!id) {
			setFlash({ type: 'error', message: 'Unexpected Error: missing user id' }, cookies);
			return fail(400);
		}

		if (id === locals.user?.id) {
			setFlash({ type: 'error', message: 'You cannot delete your own account.' }, cookies);
			return fail(409);
		}

		try {
			await db.transaction(async (tx) => {
				await softDeleteUser(tx, id, locals.user?.id);
			});
		} catch (err) {
			console.error('Error deleting user:', err);
			setFlash(
				{
					type: 'error',
					message: `Could not delete user: ${err instanceof Error ? err.message : 'Unknown error'}`
				},
				cookies
			);
			return fail(500);
		}

		redirect(
			'/dashboard/admin-panel/users',
			{ type: 'success', message: 'User deleted and signed out everywhere.' },
			cookies
		);
	}
};
