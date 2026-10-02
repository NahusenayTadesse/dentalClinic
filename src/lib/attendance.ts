/**
 * What one member of staff's day was — present, absent, excused, on leave, the clinic closed, or
 * a day off — from their schedule, what was recorded, and what else was true that day.
 *
 * **The one rule**, read by the register, the month grid, payroll and the reports, so a day cannot
 * be "absent" on the grid and paid on the payslip. Client-safe and pure: the server gathers the
 * facts (`server/attendance.ts`), this decides.
 *
 * **An absence is a scheduled working day with nothing recorded** — no check-in, no excuse, no
 * approved leave, no closure. The clinic chose that over typing absences in: a day nobody wrote
 * down used to be a day paid, and nothing could show who simply did not come. The cost is that a
 * forgotten tick reads as an absence, which is why payroll lists the unrecorded days before paying
 * and why excusing a day is one click.
 *
 * **Not judged** — neither present nor absent — are days before the employee was hired, days before
 * their branch started keeping the register (otherwise every day of history would be an absence),
 * days not yet come, and today until it is over: "not in yet" is not "absent".
 *
 * Lateness and leaving early are measured against the schedule and **shown, never deducted** — the
 * clinic's decision. Non-goal: overtime from clocked hours; overtime is recorded on its own ledger.
 */

/** `staff_schedule.week_day`: 0 is Monday, as the schedule form writes it (`getWeekdayName`). */
export type ScheduleDay = { start: string; end: string };

/** One recorded day, as the register keeps it. */
export type AttendanceRecord = {
	status: 'present' | 'excused';
	clockIn: string | null;
	clockOut: string | null;
	note: string | null;
};

export type DayKind =
	| 'present'
	| 'absent'
	| 'excused'
	| 'leave'
	| 'closed'
	| 'off'
	| 'notYet'
	| 'unjudged';

export type DayStatus = {
	kind: DayKind;
	/** Scheduled hours that day, `HH:MM`, or null on a day off. */
	scheduled: ScheduleDay | null;
	/** Minutes after the scheduled start they came in; 0 when on time or unscheduled. */
	late: number;
	/** Minutes before the scheduled end they left; 0 when on time, still in, or unscheduled. */
	early: number;
	/** Minutes between in and out; 0 until they clock out. */
	worked: number;
	/** In, and not yet out. */
	open: boolean;
};

/** The facts about one person's day that the rule reads. */
export type DayFacts = {
	day: string;
	today: string;
	/** The first day this person's attendance is judged: the later of hire and register start. */
	judgedFrom: string | null;
	schedule: ScheduleDay | null;
	record: AttendanceRecord | null;
	onLeave: boolean;
	closed: boolean;
};

/** Monday-first weekday of a `YYYY-MM-DD` day, to match `staff_schedule.week_day`. */
export function scheduleWeekday(day: string): number {
	const sundayFirst = new Date(`${day}T00:00:00Z`).getUTCDay();
	return (sundayFirst + 6) % 7;
}

/** Minutes since midnight of an `HH:MM` or `HH:MM:SS` clock time. */
export function minutesOf(clock: string): number {
	const [h, m] = clock.split(':').map(Number);
	return h * 60 + m;
}

/** Decides one day. */
export function dayStatus(facts: DayFacts): DayStatus {
	const { day, today, schedule, record } = facts;
	const base = { scheduled: schedule, late: 0, early: 0, worked: 0, open: false };

	// A recorded day is what it says, judged or not: someone who came in on a day off came in.
	if (record?.status === 'present' && record.clockIn) {
		const inAt = minutesOf(record.clockIn);
		const outAt = record.clockOut ? minutesOf(record.clockOut) : null;
		return {
			kind: 'present',
			scheduled: schedule,
			late: schedule ? Math.max(0, inAt - minutesOf(schedule.start)) : 0,
			early: schedule && outAt !== null ? Math.max(0, minutesOf(schedule.end) - outAt) : 0,
			worked: outAt !== null ? Math.max(0, outAt - inAt) : 0,
			open: outAt === null
		};
	}
	if (record?.status === 'excused') return { ...base, kind: 'excused' };

	if (facts.closed) return { ...base, kind: 'closed' };
	if (facts.onLeave) return { ...base, kind: 'leave' };
	if (!schedule) return { ...base, kind: 'off' };
	if (facts.judgedFrom === null || day < facts.judgedFrom || day > today) {
		return { ...base, kind: 'unjudged' };
	}
	if (day === today) return { ...base, kind: 'notYet' };
	return { ...base, kind: 'absent' };
}

/** How each kind reads on screen, and the one letter the month grid shows. */
export const DAY_LABEL: Record<DayKind, { label: string; short: string }> = {
	present: { label: 'Present', short: 'P' },
	absent: { label: 'Absent', short: 'A' },
	excused: { label: 'Excused', short: 'E' },
	leave: { label: 'On leave', short: 'L' },
	closed: { label: 'Clinic closed', short: 'C' },
	off: { label: 'Day off', short: '' },
	notYet: { label: 'Not in yet', short: '?' },
	unjudged: { label: 'Not counted', short: '' }
};

/** A month's or a range's figures for one person, from their days. */
export function summarise(days: DayStatus[]) {
	return {
		present: days.filter((d) => d.kind === 'present').length,
		absent: days.filter((d) => d.kind === 'absent').length,
		excused: days.filter((d) => d.kind === 'excused').length,
		leave: days.filter((d) => d.kind === 'leave').length,
		late: days.filter((d) => d.late > 0).length,
		lateMinutes: days.reduce((sum, d) => sum + d.late, 0),
		earlyMinutes: days.reduce((sum, d) => sum + d.early, 0),
		workedMinutes: days.reduce((sum, d) => sum + d.worked, 0)
	};
}

/** `HH:MM` for a number of minutes — "7:45" worked, "0:12" late. */
export function hoursAndMinutes(minutes: number): string {
	const h = Math.floor(minutes / 60);
	const m = minutes % 60;
	return `${h}:${String(m).padStart(2, '0')}`;
}

/** Every `YYYY-MM-DD` from `from` to `to`, inclusive. */
export function daysBetween(from: string, to: string): string[] {
	const out: string[] = [];
	const end = Date.parse(`${to}T00:00:00Z`);
	for (let t = Date.parse(`${from}T00:00:00Z`); t <= end; t += 86_400_000) {
		out.push(new Date(t).toISOString().slice(0, 10));
	}
	return out;
}
