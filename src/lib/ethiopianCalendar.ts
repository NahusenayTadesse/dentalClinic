/**
 * Ethiopian dates to Gregorian ones, worked out from the platform's own Ethiopic calendar.
 *
 * **Why not `ethiopian-calendar-new`.** That library is a day early for the whole Ethiopian year
 * that follows a leap year: it puts Meskerem 1, 2016 on 11 September 2023, when the new year fell on
 * the 12th, and does the same to every day of 2016 and of 2020 (September 2027 to September 2028).
 * Found while building the HMIS return (`hmisReport.test.ts` pins the dates). `Intl`'s Ethiopic
 * calendar is ICU's, the same one every browser and Node ship, and has the year right.
 *
 * The method needs only one lookup per year. Every Ethiopian month is thirty days, and Pagume
 * takes the rest, so a date is Meskerem 1 plus a count of days; and Meskerem 1 always falls between
 * 11 and 12 September of the Gregorian year seven or eight ahead, which is a short search.
 *
 * Non-goals: formatting (`formatEthiopianDate` in `global.svelte.ts` does that, also through
 * `Intl`) and converting the other way.
 */

const ethiopic = new Intl.DateTimeFormat('en-u-ca-ethiopic', {
	year: 'numeric',
	month: 'numeric',
	day: 'numeric',
	timeZone: 'UTC'
});

/** The Ethiopic year, month and day of a UTC date. */
function ethiopicParts(date: Date): { year: number; month: number; day: number } {
	const parts = ethiopic.formatToParts(date);
	const read = (type: string) =>
		Number(parts.find((p) => p.type === type)?.value.replace(/\D/g, '') ?? NaN);
	return { year: read('year'), month: read('month'), day: read('day') };
}

const yearStarts = new Map<number, Date>();

/** Meskerem 1 of an Ethiopian year, as a UTC midnight. */
function meskeremOne(year: number): Date {
	const known = yearStarts.get(year);
	if (known) return known;
	for (const day of [10, 11, 12, 13]) {
		const candidate = new Date(Date.UTC(year + 7, 8, day));
		const e = ethiopicParts(candidate);
		if (e.year === year && e.month === 1 && e.day === 1) {
			yearStarts.set(year, candidate);
			return candidate;
		}
	}
	throw new Error(`No Meskerem 1 found for Ethiopian year ${year}`);
}

/**
 * The Gregorian day, as `YYYY-MM-DD`, of an Ethiopian date. `month` 13 is Pagume. Out-of-range
 * days run on into the next month, as the arithmetic implies, rather than throwing.
 */
export function ethiopianToIso(year: number, month: number, day: number): string {
	const start = meskeremOne(year);
	const date = new Date(start.getTime() + ((month - 1) * 30 + (day - 1)) * 86_400_000);
	return date.toISOString().slice(0, 10);
}
