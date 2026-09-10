import type { LayoutServerLoad } from './$types';
import { parseFilters } from './filters';
import { filterOptions } from './details.server';

/**
 * The query builder lives in the layout, so its option lists are fetched once
 * per visit rather than once per report — moving between pages keeps the same
 * filters and does not refetch every department, branch and employee.
 */
export const load: LayoutServerLoad = async ({ url }) => {
	return {
		filters: parseFilters(url),
		filterOptions: await filterOptions()
	};
};
