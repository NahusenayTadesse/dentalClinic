import { describe, it, expect } from 'vitest';
import { calendarDays, computeLeaveDays, formatDays } from './leaveDays';

describe('calendarDays', () => {
	it('counts both ends of the span', () => {
		expect(calendarDays('2026-03-02', '2026-03-02')).toBe(1);
		expect(calendarDays('2026-03-02', '2026-03-06')).toBe(5);
	});

	it('is unaffected by a daylight saving boundary', () => {
		expect(calendarDays('2026-03-28', '2026-03-30')).toBe(3);
	});
});

describe('computeLeaveDays', () => {
	it('matches the old whole-day count when no half is flagged', () => {
		expect(computeLeaveDays({ startDate: '2026-03-02', endDate: '2026-03-06' })).toBe(5);
		expect(computeLeaveDays({ startDate: '2026-03-02', endDate: '2026-03-02' })).toBe(1);
	});

	it('counts a single-day leave as half when either flag is set', () => {
		const day = { startDate: '2026-03-02', endDate: '2026-03-02' };

		expect(computeLeaveDays({ ...day, halfDayStart: true })).toBe(0.5);
		expect(computeLeaveDays({ ...day, halfDayEnd: true })).toBe(0.5);
		// Both flags point at the same day, so it is only ever docked once.
		expect(computeLeaveDays({ ...day, halfDayStart: true, halfDayEnd: true })).toBe(0.5);
	});

	it('takes half off each flagged boundary of a multi-day leave', () => {
		const span = { startDate: '2026-03-02', endDate: '2026-03-06' };

		expect(computeLeaveDays({ ...span, halfDayStart: true })).toBe(4.5);
		expect(computeLeaveDays({ ...span, halfDayEnd: true })).toBe(4.5);
		expect(computeLeaveDays({ ...span, halfDayStart: true, halfDayEnd: true })).toBe(4);
	});

	it('returns 0 when the end date precedes the start date', () => {
		expect(computeLeaveDays({ startDate: '2026-03-06', endDate: '2026-03-02' })).toBe(0);
	});

	it('stays exact when halves are summed, so balances do not drift', () => {
		let total = 0;
		for (let i = 0; i < 10; i++) {
			total += computeLeaveDays({
				startDate: '2026-03-02',
				endDate: '2026-03-02',
				halfDayStart: true
			});
		}
		expect(total).toBe(5);
	});
});

describe('formatDays', () => {
	it('drops the trailing zero a decimal column brings back', () => {
		expect(formatDays(5)).toBe('5 days');
		expect(formatDays('5.0')).toBe('5 days');
	});

	it('keeps the half and singularises one day', () => {
		expect(formatDays(1)).toBe('1 day');
		expect(formatDays(0.5)).toBe('0.5 days');
		expect(formatDays(4.5)).toBe('4.5 days');
	});

	it('falls back to zero for missing values', () => {
		expect(formatDays(null)).toBe('0 days');
		expect(formatDays(undefined)).toBe('0 days');
	});
});
