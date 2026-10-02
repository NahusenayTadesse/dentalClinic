/**
 * Clock time at the clinic, independent of where the server or the browser happens to run.
 *
 * **Why this exists.** Drizzle writes a `datetime` as the value's UTC wall clock and reads it back
 * the same way (`mapToDriverValue` is `toISOString()` without the `Z`). That round trip is exact,
 * but it means "9:00 in Addis Ababa" is stored as `06:00`, and anything that builds a time with
 * `new Date(2026, 8, 13, 9)` or reads one with `getHours()` is using the *process's* timezone — the
 * dev laptop's, the cPanel box's, the Vercel function's — and the three disagree. An appointment
 * booked at nine would show at six on one screen and nine on another.
 *
 * So times cross the boundary in one of two shapes only: a `Date` (an instant, timezone-free), or a
 * clinic-local `YYYY-MM-DD` / `HH:mm` string. Every conversion between them is here, and always
 * through `CLINIC_TIME_ZONE`.
 *
 * Client-safe: the day view and the booking form need the same conversions as the server.
 *
 * Non-goal: a clinic in another timezone. Ethiopia is UTC+3 all year with no daylight saving, which
 * is why the offset below can be a constant. A deployment elsewhere changes the two constants.
 */

/** The IANA zone the clinic's clocks follow. */
export const CLINIC_TIME_ZONE = 'Africa/Addis_Ababa';

/** Its fixed UTC offset, for building an instant from a local date and time. No DST here. */
const CLINIC_UTC_OFFSET = '+03:00';

const dateParts = new Intl.DateTimeFormat('en-CA', {
	timeZone: CLINIC_TIME_ZONE,
	year: 'numeric',
	month: '2-digit',
	day: '2-digit'
});

const clockParts = new Intl.DateTimeFormat('en-GB', {
	timeZone: CLINIC_TIME_ZONE,
	hour: '2-digit',
	minute: '2-digit',
	hourCycle: 'h23'
});

/** The clinic-local calendar date of an instant, as `YYYY-MM-DD`. */
export function clinicDate(instant: Date | string): string {
	return dateParts.format(new Date(instant));
}

/** The clinic-local clock time of an instant, as `HH:mm` (24-hour). */
export function clinicClock(instant: Date | string): string {
	return clockParts.format(new Date(instant));
}

/** Minutes since clinic-local midnight — where a block sits on the day view. */
export function clinicMinutes(instant: Date | string): number {
	const [h, m] = clinicClock(instant).split(':').map(Number);
	return h * 60 + m;
}

/** Today at the clinic, as `YYYY-MM-DD`. */
export function clinicToday(): string {
	return clinicDate(new Date());
}

/** A strict `YYYY-MM-DD` that is a real date. */
export function isIsoDate(value: string | null | undefined): value is string {
	if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
	const d = new Date(`${value}T00:00:00Z`);
	return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(value);
}

/** The instant a clinic-local date and `HH:mm` names. */
export function fromClinic(date: string, clock: string): Date {
	return new Date(`${date}T${clock}:00${CLINIC_UTC_OFFSET}`);
}

/** The instants bounding one clinic-local day: `[start, end)`. */
export function clinicDayRange(date: string): { start: Date; end: Date } {
	const start = fromClinic(date, '00:00');
	return { start, end: new Date(start.getTime() + 24 * 60 * 60_000) };
}

/** A clinic-local date moved by whole days. */
export function addClinicDays(date: string, days: number): string {
	const d = new Date(`${date}T12:00:00Z`);
	d.setUTCDate(d.getUTCDate() + days);
	return d.toISOString().slice(0, 10);
}

/**
 * A clinic-local date moved by whole months, kept to the month's last day when the day does not
 * exist there: six months after 31 August is 28 February, not 3 March. A recall due "in six months"
 * that slid into the month after would be called a month late.
 */
export function addClinicMonths(date: string, months: number): string {
	const [y, m, d] = date.split('-').map(Number);
	const target = new Date(Date.UTC(y, m - 1 + months, 1));
	const lastDay = new Date(
		Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)
	).getUTCDate();
	target.setUTCDate(Math.min(d, lastDay));
	return target.toISOString().slice(0, 10);
}

/**
 * The same instant on the Ethiopian clock, which is how most patients say a time.
 *
 * The Ethiopian day starts at dawn, so the hour count is six behind the international one: 7:00 is
 * "1 o'clock in the morning", 13:00 is "7 o'clock in the day". A receptionist telling a patient
 * "come at 9:00" is heard as three in the afternoon; the day view shows both so nobody converts in
 * their head.
 */
export function ethiopianClock(instant: Date | string): string {
	const minutes = clinicMinutes(instant);
	const h24 = Math.floor(minutes / 60);
	const mm = String(minutes % 60).padStart(2, '0');
	const h12 = (h24 + 6) % 12 || 12;
	const period =
		h24 >= 6 && h24 < 12 ? 'ጠዋት' : h24 >= 12 && h24 < 18 ? 'ከሰዓት' : h24 >= 18 ? 'ማታ' : 'ሌሊት';
	return `${period} ${h12}:${mm}`;
}
