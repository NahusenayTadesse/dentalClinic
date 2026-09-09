import { db } from '$lib/server/db';
import { and, eq, sql } from 'drizzle-orm';
import { notDeleted } from '$lib/server/softDelete';
import type { PageServerLoad } from '../$types';
import { user, roles, rolePermissions } from '$lib/server/db/schema';

export const load: PageServerLoad = async () => {
	const userList = await db
		.select({
			id: user.id,
			name: user.name,
			email: user.email,
			role: roles.name,
			roleId: user.roleId,
			status: user.isActive,
			createdAt: user.createdAt,
			permissionsCount: sql<number>`COUNT(DISTINCT ${rolePermissions.id})`
		})
		.from(user)
		.leftJoin(roles, and(eq(roles.id, user.roleId), notDeleted(roles)))
		.leftJoin(
			rolePermissions,
			and(eq(rolePermissions.roleId, roles.id), notDeleted(rolePermissions))
		)
		.where(notDeleted(user))
		.groupBy(user.id, user.name, user.email, roles.name, user.isActive, user.createdAt);

	return {
		userList
	};
};
