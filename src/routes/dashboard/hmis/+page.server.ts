import { monthlyReturn } from '$lib/server/hmisReport';
import { formatEthiopianYearMonth } from '$lib/global.svelte';
import { periodFromUrl } from '$lib/ethiopianMonth';
import type { PageServerLoad } from './$types';

/**
 * The monthly return to the health office, for the branch chosen in the top bar. One branch is one
 * facility, so with every branch selected there is no return to show — the page asks for one
 * instead of adding them up (CLAUDE.md §15).
 *
 * Gated by `reports.clinic` (`routeRules`): it reads the same clinical activity as the clinic
 * report, for the same audience.
 */
export const load: PageServerLoad = async ({ url, locals }) => {
	const period = periodFromUrl(url, 'last');
	// The picker binds the plain `<month name>_<year>`; the helper hands it back URL-encoded.
	const month = decodeURIComponent(formatEthiopianYearMonth(period.year, period.month));
	const branchId = locals.branch.active;
	if (branchId === null) return { month, period, report: null, needsBranch: true as const };

	return {
		month,
		period,
		report: await monthlyReturn(branchId, period),
		needsBranch: false as const
	};
};
