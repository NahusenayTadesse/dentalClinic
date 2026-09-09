import { db } from '$lib/server/db';
import { site } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { notDeleted } from '$lib/server/softDelete';
import type { PageServerLoad, Actions } from '../$types';

export const load: PageServerLoad = async ({ params }) => {
	const { id } = params;

	const siteName = await db
		.select({
			name: site.name
		})
		.from(site)
		.where(and(eq(site.id, id), notDeleted(site)))
		.then((res) => res[0]?.name);
	return {
		siteName
	};
};
