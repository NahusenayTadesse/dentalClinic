import { db } from '$lib/server/db';
import { permissions } from '$lib/server/db/schema/';
import type { LayoutServerLoad } from './$types.js';

export const load: LayoutServerLoad = async () => {
	const allPermissions = await db
		.select({
			value: permissions.id,
			name: permissions.description
		})
		.from(permissions)
		.orderBy(permissions.name);

	return {
		allPermissions
	};
};
