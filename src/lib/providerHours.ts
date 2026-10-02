/**
 * Whether a dentist is working when they are being booked — their weekly hours and their approved
 * leave, read against a proposed slot.
 *
 * Shared by the booking and move dialogs, which warn as the slot is chosen, and by
 * `server/appointments.ts`, which refuses the booking unless whoever books it says they know. One
 * rule in one place, so the warning and the refusal cannot disagree (the reason `allergyClash.ts`
 * is shared too).
 *
 * **A warning, not a wall.** The diary's hard refusals — a closed day, a double-booked chair or
 * dentist — are facts about the slot. These are facts about a schedule somebody typed, and a
 * dentist who comes in on a Saturday for an emergency is the clinic working, not a mistake. So a
 * booking outside the hours goes through with a tick, and the tick is in the audit row.
 *
 * **No hours means no warning.** `staff_schedule` is entered per employee and is often blank. A
 * dentist with no hours at all is read as "not recorded", not as "never works" — otherwise the
 * first clinic to install this could not book anybody until HR had typed every timetable in. Once
 * any hours exist, they are taken as the whole week: a day with none is a day off.
 *
 * Non-goals: half-day leave (the leave row's half-day flags say which half, and a booking is
 * warned for the whole day), and lunch breaks, which the schedule has no row for.
 */
import { minutesOf, scheduleWeekday } from '$lib/attendance';

/** Monday-first, as `staff_schedule.week_day` stores them. */
export const WEEKDAY_NAMES = [
	'Monday',
	'Tuesday',
	'Wednesday',
	'Thursday',
	'Friday',
	'Saturday',
	'Sunday'
] as const;

/** One stretch of a dentist's week: `HH:MM` or `HH:MM:SS` clock times, clinic-local. */
export type WorkingHours = { weekDay: number; start: string; end: string };

/** What the check needs to know about one dentist. */
export type ProviderAvailability = {
	name: string;
	/** Every stretch of the week. Empty means the schedule was never entered. */
	hours: WorkingHours[];
	/** Approved leave, as inclusive clinic-local `YYYY-MM-DD` days. */
	leave: { from: string; to: string }[];
};

/** `08:30` from `08:30:00`, for a sentence. */
const clock = (time: string) => time.slice(0, 5);

/**
 * Everything about the slot that falls outside the dentist's working time, as sentences for the
 * person booking. Empty means the slot is inside their hours, or they have none recorded.
 *
 * @param day clinic-local `YYYY-MM-DD`
 * @param time clinic-local `HH:mm`
 */
export function availabilityWarnings(
	who: ProviderAvailability,
	day: string,
	time: string,
	durationMinutes: number
): string[] {
	if (who.leave.some((l) => l.from <= day && l.to >= day)) {
		return [`${who.name} is on approved leave that day.`];
	}
	if (who.hours.length === 0) return [];

	const weekDay = scheduleWeekday(day);
	const dayName = WEEKDAY_NAMES[weekDay];
	const today = who.hours.filter((h) => h.weekDay === weekDay);
	if (today.length === 0) return [`${who.name} does not work on ${dayName}s.`];

	const start = minutesOf(time);
	const end = start + durationMinutes;
	const fits = today.some((h) => minutesOf(h.start) <= start && end <= minutesOf(h.end));
	if (fits) return [];

	const spans = today
		.toSorted((a, b) => minutesOf(a.start) - minutesOf(b.start))
		.map((h) => `${clock(h.start)}–${clock(h.end)}`)
		.join(' and ');
	return [`${who.name} works ${spans} on ${dayName}s, and this runs outside those hours.`];
}
