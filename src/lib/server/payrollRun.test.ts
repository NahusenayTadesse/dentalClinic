import { describe, expect, it } from 'vitest';
import { payrollPeriod } from './payrollRun';

/**
 * The period a payroll run pays is the route's month, as zero-padded ISO days: an unpadded day
 * ('2026-9-11') parses as local time and compares wrongly as a string, which once dropped a
 * month's commission.
 */
describe('payrollPeriod', () => {
	it('turns an Ethiopian month into its Gregorian days, padded', () => {
		const period = payrollPeriod('መስከረም_2019');
		expect(period.month).toBe('መስከረም');
		expect(period.year).toBe(2019);
		expect(period.start).toMatch(/^\d{4}-\d{2}-\d{2}$/);
		expect(period.end).toMatch(/^\d{4}-\d{2}-\d{2}$/);
		// Meskerem 2019 begins on 11 or 12 September 2026 and runs thirty days.
		expect(period.start.startsWith('2026-09-1')).toBe(true);
		const days = (Date.parse(period.end) - Date.parse(period.start)) / 86_400_000 + 1;
		expect(days).toBe(30);
	});

	it('is right in the year after an Ethiopian leap year', () => {
		// The library this replaced put both a day early: the new year fell on 12 September.
		expect(payrollPeriod('መስከረም_2016')).toMatchObject({ start: '2023-09-12', end: '2023-10-11' });
		expect(payrollPeriod('መስከረም_2020')).toMatchObject({ start: '2027-09-12', end: '2027-10-11' });
		// And after the Gregorian leap day, when it stayed a day early all year.
		expect(payrollPeriod('መጋቢት_2016')).toMatchObject({ start: '2024-03-10', end: '2024-04-08' });
	});
});
