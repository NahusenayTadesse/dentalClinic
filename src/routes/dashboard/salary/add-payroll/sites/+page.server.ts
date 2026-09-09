import { db } from '$lib/server/db';
import { employee, site } from '$lib/server/db/schema';
import { eq, and, count } from 'drizzle-orm';
import { notDeleted } from '$lib/server/softDelete';
import type { PageServerLoad, Actions } from '../$types';

export const load: PageServerLoad = async () => {
	let siteList = await db
		.select({
			id: site.id,
			name: site.name,
			numbers: count(employee.id)
		})
		.from(site)
		.innerJoin(employee, and(eq(employee.siteId, site.id), notDeleted(employee)))
		.where(and(eq(employee.isActive, true), notDeleted(site)))
		.groupBy(site.id);

	return {
		siteList
	};
};
