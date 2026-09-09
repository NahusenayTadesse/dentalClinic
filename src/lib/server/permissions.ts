import { error } from '@sveltejs/kit';
import { and, count, countDistinct, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { permissions, rolePermissions, user } from '$lib/server/db/schema';
import { notDeleted } from '$lib/server/softDelete';

/**
 * A super admin is a user who holds *every* permission that exists — either
 * because their role grants all of them, or because they have the full set as
 * special permissions. There is no `isSuperAdmin` flag on the user; the status
 * is derived, so granting a new permission to the system automatically demotes
 * anyone who does not also receive it.
 *
 * `locals.permList` is built in `hooks.server.ts` and is already either the
 * special-permission set or the role set (special wins when present), so the
 * only question left here is whether it covers the whole table.
 */
export async function computeIsSuperAdmin(permList: string[]): Promise<boolean> {
	if (!permList.length) return false;

	const [{ total }] = await db.select({ total: count() }).from(permissions);

	// An empty permissions table would otherwise make everyone a super admin.
	if (!total) return false;

	// Deduplicated: a role with the same permission attached twice must not be
	// able to reach the total by counting one grant more than once.
	return new Set(permList).size === total;
}

/**
 * Guard for actions only a super admin may run. Every delete action calls this
 * before touching a row — hiding the button in the UI is a convenience, not a
 * control, since the form action is reachable by anyone who can POST to it.
 */
export function requireSuperAdmin(locals: App.Locals) {
	if (!locals.isSuperAdmin) {
		error(403, 'Only a super administrator can delete records.');
	}
}

/**
 * Mirrors the app's notion of "administrator" onto `user.role`, the string better-auth's admin
 * plugin gates its own endpoints on.
 *
 * The two systems answer different questions — `roleId` decides what pages a person can open,
 * `role` decides whether they may call `createUser`/`banUser`/`revokeUserSessions` — and nothing
 * keeps them in step automatically. Rather than let them drift, `role` is derived from the same
 * rule as `isSuperAdmin`: a role holding every permission is an administrator, anything less is
 * not. Call this wherever a user's `roleId` is set or changed.
 */
export async function syncAdminRole(userId: string, roleId: number) {
	const [[{ total }], [held]] = await Promise.all([
		db.select({ total: count() }).from(permissions),
		db
			.select({ held: countDistinct(rolePermissions.permissionId) })
			.from(rolePermissions)
			.where(and(eq(rolePermissions.roleId, roleId), notDeleted(rolePermissions)))
	]);

	// An empty permissions table would otherwise make every role an administrator.
	const isAdmin = total > 0 && held?.held === total;

	await db
		.update(user)
		.set({ role: isAdmin ? 'admin' : 'user' })
		.where(eq(user.id, userId));

	return isAdmin;
}
