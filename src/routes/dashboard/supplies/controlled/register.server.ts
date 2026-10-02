import { formatEthiopianYearMonth } from '$lib/global.svelte';
import { periodFromUrl } from '$lib/ethiopianMonth';
import { controlledReturn, registerFor } from '$lib/server/controlledDrugs';
import type { BranchContext } from '$lib/server/branchScope';

/**
 * What the register screen and its printout both read: the month (the one in progress unless the
 * URL names another — a register is kept as it happens), the return for every controlled item,
 * and the register of the one chosen. One function, so the screen and the paper cannot disagree.
 */
export async function registerPage(url: URL, scope: Pick<BranchContext, 'active'>) {
	const period = periodFromUrl(url, 'current');
	// The picker binds the plain `<month name>_<year>`; the helper hands it back URL-encoded.
	const month = decodeURIComponent(formatEthiopianYearMonth(period.year, period.month));
	const sheet = await controlledReturn(scope, period);
	const asked = Number(url.searchParams.get('item'));
	const chosen = sheet.find((r) => r.item.id === asked)?.item ?? sheet[0]?.item ?? null;
	return {
		month,
		period,
		sheet,
		chosen,
		register: chosen ? await registerFor(chosen, period) : null
	};
}
