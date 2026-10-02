/**
 * The shape of the Ministry of Health's monthly return (HMIS), as one dental clinic files it: the
 * reporting month, the age groups, and a tally of people by age group and sex.
 *
 * Client-safe, because both halves need it: `server/hmisReport.ts` counts into these tallies, and
 * the screen and the printed sheet draw them. One definition of an age group, so the column a
 * patient is counted in cannot differ between the two.
 *
 * **Check against the form you are given.** The age groups and the month rule below are the
 * national HMIS conventions as best this module knows them; a health office may issue a revised
 * form, and the groups are one constant to change when it does.
 *
 *   - **Age groups**: under 1, 1–4, 5–14, 15–29, 30–64, 65 and over — the morbidity groups of the
 *     national HMIS. Age is in completed years **on the day of the visit or diagnosis**, not today,
 *     so a report re-run next year counts the same child in the same column.
 *   - **The month** is the Ethiopian month. Pagume, the short thirteenth month, is reported with
 *     Nehase rather than on its own, as `getEthiopianYearMonth` already folds it in elsewhere.
 *
 * Non-goals: submitting anything. The return is printed or downloaded and entered into DHIS2 or
 * handed to the health office by a person; this system has no connection to either.
 */
import { ethiopianToIso } from '$lib/ethiopianCalendar';
import { getMonthNumber } from '$lib/global.svelte';

/** The age groups, in column order. `max` is inclusive, in completed years. */
export const HMIS_AGE_BANDS = [
	{ key: 'under1', label: '< 1', min: 0, max: 0 },
	{ key: 'oneToFour', label: '1–4', min: 1, max: 4 },
	{ key: 'fiveToFourteen', label: '5–14', min: 5, max: 14 },
	{ key: 'fifteenToTwentyNine', label: '15–29', min: 15, max: 29 },
	{ key: 'thirtyToSixtyFour', label: '30–64', min: 30, max: 64 },
	{ key: 'sixtyFivePlus', label: '65+', min: 65, max: Infinity }
] as const;

/** An age group, or `unknown` for a patient with no birth date recorded. */
export type HmisBand = (typeof HMIS_AGE_BANDS)[number]['key'] | 'unknown';

/** Every column a tally has, `unknown` last. */
export const HMIS_BAND_KEYS: readonly HmisBand[] = [...HMIS_AGE_BANDS.map((b) => b.key), 'unknown'];

/** How a column is headed: the group's range, or "Age unknown". */
export function bandLabel(key: HmisBand): string {
	if (key === 'unknown') return 'Age unknown';
	return HMIS_AGE_BANDS.find((b) => b.key === key)?.label ?? key;
}

/** A patient's recorded sex, as `patient.sex` stores it. */
export type HmisSex = 'male' | 'female';

/** People counted by age group and sex. */
export type Tally = Record<HmisBand, Record<HmisSex, number>>;

/** Completed years between a `YYYY-MM-DD` birth date and a `YYYY-MM-DD` day. */
export function ageOn(birthDate: string, day: string): number {
	const [by, bm, bd] = birthDate.split('-').map(Number);
	const [y, m, d] = day.split('-').map(Number);
	return y - by - (m < bm || (m === bm && d < bd) ? 1 : 0);
}

/** The age group a patient falls in on `day`. */
export function hmisBand(birthDate: string | null, day: string): HmisBand {
	if (!birthDate) return 'unknown';
	const age = ageOn(birthDate, day);
	// A birth date after the visit is a typing mistake, not a patient; it is counted as unknown
	// rather than as an infant.
	if (age < 0) return 'unknown';
	return HMIS_AGE_BANDS.find((b) => age >= b.min && age <= b.max)?.key ?? 'unknown';
}

/** A tally with every cell at zero. */
export function emptyTally(): Tally {
	const zero = () => ({ male: 0, female: 0 });
	return {
		under1: zero(),
		oneToFour: zero(),
		fiveToFourteen: zero(),
		fifteenToTwentyNine: zero(),
		thirtyToSixtyFour: zero(),
		sixtyFivePlus: zero(),
		unknown: zero()
	};
}

/** Counts one person into a tally. */
export function countInto(tally: Tally, band: HmisBand, sex: HmisSex): void {
	tally[band][sex] += 1;
}

/** A tally's totals: by sex, and altogether. */
export function tallyTotals(tally: Tally): Record<HmisSex | 'all', number> {
	let male = 0;
	let female = 0;
	for (const key of HMIS_BAND_KEYS) {
		male += tally[key].male;
		female += tally[key].female;
	}
	return { male, female, all: male + female };
}

/** The Ethiopian month a return is for, and its Gregorian first and last day. */
export type HmisPeriod = { month: number; year: number; start: string; end: string };

/**
 * The reporting period for an Ethiopian month (1–12) and year. Nehase runs on to the eve of the
 * next Meskerem 1, which takes in Pagume whether it has five days or six that year.
 */
export function hmisPeriod(month: number, year: number): HmisPeriod {
	const start = ethiopianToIso(year, month, 1);
	const next = month === 12 ? ethiopianToIso(year + 1, 1, 1) : ethiopianToIso(year, month + 1, 1);
	const eve = new Date(`${next}T00:00:00Z`);
	eve.setUTCDate(eve.getUTCDate() - 1);
	return { month, year, start, end: eve.toISOString().slice(0, 10) };
}

/**
 * The period a `?month=<month name>_<year>` parameter names — the format the month picker writes
 * and the attendance register reads — or null when it names no real month.
 */
export function hmisPeriodFromParam(param: string | null): HmisPeriod | null {
	if (!param) return null;
	const [name, y] = param.split('_');
	const month = getMonthNumber(name ?? '');
	const year = Number(y);
	if (month < 1 || month > 12 || !Number.isInteger(year) || year < 1900 || year > 2200) return null;
	return hmisPeriod(month, year);
}
