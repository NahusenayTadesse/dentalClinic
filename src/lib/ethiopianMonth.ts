/**
 * An Ethiopian month as a period of Gregorian days — what a monthly return, a register or a report
 * is for. Client-safe, and shared by every screen that files something by the month: the HMIS
 * return and the controlled-medicine register, which used to be one screen's private helpers.
 *
 * `?month=<month name>_<year>` is how a month travels in a URL: the format the month picker
 * (`MonthYear`) writes and the attendance register reads.
 */
import { getEthiopianYearMonth, getMonthNumber } from '$lib/global.svelte';
import { ethiopianToIso, ethiopianYearEnd } from '$lib/ethiopianCalendar';

/** An Ethiopian month, and its Gregorian first and last day. */
export type MonthPeriod = { month: number; year: number; start: string; end: string };

/**
 * The period of an Ethiopian month (1–12) and year. Nehase runs on to the eve of the next
 * Meskerem 1, which takes in Pagume whether it has five days or six that year.
 */
export function monthPeriod(month: number, year: number): MonthPeriod {
	const start = ethiopianToIso(year, month, 1);
	const end = month === 12 ? ethiopianYearEnd(year) : ethiopianToIso(year, month, 30);
	return { month, year, start, end };
}

/** The period a `?month=` parameter names, or null when it names no real month. */
export function monthPeriodFromParam(param: string | null): MonthPeriod | null {
	if (!param) return null;
	const [name, y] = param.split('_');
	const month = getMonthNumber(name ?? '');
	const year = Number(y);
	if (month < 1 || month > 12 || !Number.isInteger(year) || year < 1900 || year > 2200) return null;
	return monthPeriod(month, year);
}

/**
 * The month a URL asks for, or else `fallback`: the month in progress (a register being kept), or
 * the last one that has ended (a return, which is filed after its month closes). Shared by a
 * screen and its printed sheet, so the two cannot open on different months.
 */
export function periodFromUrl(url: URL, fallback: 'current' | 'last'): MonthPeriod {
	const asked = monthPeriodFromParam(url.searchParams.get('month'));
	if (asked) return asked;
	const now = getEthiopianYearMonth(new Date()) ?? { year: 2019, month: 1 };
	if (fallback === 'current') return monthPeriod(now.month, now.year);
	return now.month === 1 ? monthPeriod(12, now.year - 1) : monthPeriod(now.month - 1, now.year);
}
