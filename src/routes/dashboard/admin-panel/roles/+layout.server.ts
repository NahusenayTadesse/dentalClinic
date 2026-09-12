import { sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { permissions } from '$lib/server/db/schema/';
import type { LayoutServerLoad } from './$types.js';

export const load: LayoutServerLoad = async () => {
	const allPermissions = await db
		.select({
			value: permissions.id,
			// `description` is nullable, so an unworded permission would render a blank option.
			// COALESCE is standard across all three engines (CLAUDE.md §10).
			name: sql<string>`COALESCE(${permissions.description}, ${permissions.name})`
		})
		.from(permissions)
		.orderBy(permissions.name);

	return {
		allPermissions
	};
};
