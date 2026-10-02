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
import { recordAudit } from '$lib/server/audit';
import { requireSuperAdmin, syncAdminRole } from '$lib/server/permissions';
import { setFlash, redirect } from 'sveltekit-flash-message/server';
import { error } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { fail } from 'sveltekit-superforms';
export const load: PageServerLoad = async ({ params, locals }) => {
	const { id } = params;

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

	// A thrown 404, not a returned `fail`: returning made every field of the page's data optional.
	if (!singleUser) error(404, 'User not found');

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
			// `description` is nullable, so an unworded permission would render a blank option.
			// COALESCE is standard across all three engines (CLAUDE.md §10).
			name: sql<string>`COALESCE(${permissions.description}, ${permissions.name})`,
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
			name: sql<string>`COALESCE(${permissions.description}, ${permissions.name})`,
			description: permissions.name
		})
		.from(permissions)
		.innerJoin(
			userPermissions,
			and(eq(permissions.id, userPermissions.permissionId), notDeleted(userPermissions))
		)
		.where(eq(userPermissions.userId, id));

	// A user's own permissions replace their role's; with none of their own, they have the role's.
	const permissionList = userPermissionsList.length > 0 ? userPermissionsList : rolePermissionList;

	const allPerms = await db
		.select({
			value: permissions.id,
			name: sql<string>`COALESCE(${permissions.description}, ${permissions.name})`,
			description: permissions.name
		})
		.from(permissions)
		.orderBy(permissions.name);

	// The edit dialog starts from what is saved, so the form is validated from the row itself.
	const form = await superValidate(
		{
			name: singleUser.name,
			email: singleUser.email,
			role: singleUser.roleId,
			status: singleUser.status,
			permissionsList: permissionList.map((p) => p.value),
			editPermission: false
		},
		zod4(schema),
		{ errors: false }
	);

	return {
		singleUser,
		id,
		// So the page can stop someone deleting their own account (the action refuses it too).
		viewerId: locals.user?.id ?? null,
		form,
		roleList,
		permissionList,
		allPerms
	};
};

export const actions: Actions = {
	/**
	 * Changes a user's name, email, role, status and — when asked — their own permission set, then
	 * ends their sessions so the change bites on their next request. Audited (CLAUDE.md §11: who
	 * may do what); the permission set is recorded as changed, by count, not listed.
	 */
	editUser: async (event) => {
		const { request, params } = event;
		const form = await superValidate(request, zod4(schema));
		if (!form.valid) {
			return message(form, { type: 'error', text: 'Please check the form for errors.' });
		}

		const { id } = params;
		const { name, email, role, status, permissionsList, editPermission } = form.data;

		// Refused before anything is written: inside the transaction the refusal used to be returned
		// from the callback, which committed the name and role change it was meant to stop.
		if (editPermission && permissionsList.length === 0) {
			return setError(form, 'permissionsList._errors', 'Choose at least one permission');
		}

		try {
			await db.transaction(async (tx) => {
				const [before] = await tx
					.select({
						name: user.name,
						email: user.email,
						roleId: user.roleId,
						isActive: user.isActive
					})
					.from(user)
					.where(eq(user.id, id));
				const after = { name, email, roleId: role, isActive: status };
				await tx.update(user).set(after).where(eq(user.id, id));

				if (editPermission) {
					await tx.delete(userPermissions).where(eq(userPermissions.userId, id));
					await tx
						.insert(userPermissions)
						.values(permissionsList.map((permissionId) => ({ userId: id, permissionId })));
				}

				await recordAudit(tx, event, {
					table: 'user',
					recordId: id,
					action: 'update',
					before,
					after,
					detail: editPermission ? { permissionsSet: permissionsList.length } : undefined
				});

				// A role or permission change has to bite on the next request, not whenever the
				// cookie happens to expire, so every session this user holds is ended here.
				await tx.delete(session).where(eq(session.userId, id));
			});

			// `roleId` just changed, so the admin plugin's own `user.role` has to follow it.
			// See `syncAdminRole` for why the two are kept in step rather than set by hand.
			await syncAdminRole(id, role);
		} catch (err: unknown) {
			// Loud in the log, quiet to the client (CLAUDE.md §9).
			console.error('user update failed', err);
			return message(form, { type: 'error', text: 'The user could not be saved' }, { status: 500 });
		}
		return message(form, { type: 'success', text: 'User saved. They have been signed out.' });
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
