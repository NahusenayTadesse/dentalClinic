import { db } from '$lib/server/db';
import { eq, countDistinct, and } from 'drizzle-orm';
import { notDeleted } from '$lib/server/softDelete';
import type { PageServerLoad } from './$types';
import { user, roles, rolePermissions } from '$lib/server/db/schema';

export const load: PageServerLoad = async () => {
	const roleList = await db
		.select({
			id: roles.id,
			name: roles.name,
			description: roles.description,
			userCount: countDistinct(user.id),
			permissionsCount: countDistinct(rolePermissions.id),
			status: roles.isActive
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
		.where(notDeleted(roles))
		.groupBy(roles.id);

	return {
		roleList
	};
};
