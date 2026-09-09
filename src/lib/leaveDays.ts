// How long a leave request actually is.
//
// A leave is stored as a start date, an end date, and a flag on each boundary day saying that
// day is only a half. The duration that falls out of that is what the accrual ledger spends, so
// it is computed in exactly one place and stored on the row rather than re-derived at every
// call site. It lives outside $lib/server so the form can preview the same figure the server stores.

export type LeaveSpan = {
	startDate: Date | string;
	endDate: Date | string;
	halfDayStart?: boolean | null;
	halfDayEnd?: boolean | null;
};

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/**
 * Whole calendar days covered by the span, inclusive of both ends — the figure the app used
 * before half days existed.
 */
export function calendarDays(startDate: Date | string, endDate: Date | string): number {
	const start = startDate instanceof Date ? startDate : new Date(startDate);
	const end = endDate instanceof Date ? endDate : new Date(endDate);

	return Math.round((end.getTime() - start.getTime()) / MS_PER_DAY) + 1;
}

/**
 * Days the leave costs, in units of 0.5.
 *
 * A single-day leave marked half on either boundary is 0.5 — the two flags refer to the same
 * day, so it is only ever docked once. On a multi-day leave the flags are independent: each
 * half boundary takes 0.5 off the total.
 *
 * Halves are exact in binary floating point, so this arithmetic does not drift.
 */
export function computeLeaveDays(span: LeaveSpan): number {
	const whole = calendarDays(span.startDate, span.endDate);
	if (whole <= 0) return 0;

	if (whole === 1) return span.halfDayStart || span.halfDayEnd ? 0.5 : 1;

	return whole - (span.halfDayStart ? 0.5 : 0) - (span.halfDayEnd ? 0.5 : 0);
}

/**
 * Day counts for display: `1.5 days`, `1 day`, `0.5 days`. Trailing `.0` is dropped, because
 * every whole-day figure in the app would otherwise start reading as `5.0 days`.
 */
export function formatDays(value: number | string | null | undefined): string {
	const days = Number(value ?? 0);
	if (!Number.isFinite(days)) return '0 days';

	const text = Number.isInteger(days) ? String(days) : days.toFixed(1);
	return `${text} ${days === 1 ? 'day' : 'days'}`;
}
