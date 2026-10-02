import { getEthiopianYearMonth } from '$lib/global.svelte';
import { hmisPeriod, hmisPeriodFromParam, type HmisPeriod } from '$lib/hmisReport';

/**
 * The month a return is for: the one `?month=<month name>_<year>` names, or else the last one
 * that has ended — a return is filed after its month closes, so that is the one being asked for.
 * Shared by the screen and the printed sheet, so the two cannot open on different months.
 */
export function requestedPeriod(url: URL): HmisPeriod {
	const asked = hmisPeriodFromParam(url.searchParams.get('month'));
	if (asked) return asked;
	const now = getEthiopianYearMonth(new Date()) ?? { year: 2019, month: 1 };
	return now.month === 1 ? hmisPeriod(12, now.year - 1) : hmisPeriod(now.month - 1, now.year);
}
