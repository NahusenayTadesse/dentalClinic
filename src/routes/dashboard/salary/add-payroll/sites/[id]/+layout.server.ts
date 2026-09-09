import type { LayoutServerLoad } from './$types';
import { db } from '$lib/server/db';
import { eq, and } from 'drizzle-orm';
import { notDeleted } from '$lib/server/softDelete';

import { site } from '$lib/server/db/schema';
import { error } from '@sveltejs/kit';

export const load: LayoutServerLoad = async ({ params }) => {
	const { id } = params;

	const siteData = await db
		.select({
			name: site.name
		})
		.from(site)
		.where(and(eq(site.id, Number(id)), notDeleted(site)))
		.limit(1)
		.then((rows) => rows[0]);

	if (!siteData) {
		error(404, 'Site not found');
	}

	const siteName = siteData.name;

	return {
		siteName
	};
};
