import { describe, it, expect } from 'vitest';
import {
	getEthiopianYearMonth,
	currentEthiopianMonthParam,
	formatEthiopianYearMonth
} from './global.svelte';

/** Noon UTC, so a timezone offset either side cannot tip the date over a boundary. */
const at = (iso: string) => new Date(`${iso}T12:00:00Z`);

describe('getEthiopianYearMonth', () => {
	it('maps dates on either side of the Ethiopian new year', () => {
		// Meskerem 1 is 11 September; the year rolls over with it.
		expect(getEthiopianYearMonth(at('2026-09-10'))).toEqual({ year: 2018, month: 12 });
		expect(getEthiopianYearMonth(at('2026-09-11'))).toEqual({ year: 2019, month: 1 });
		expect(getEthiopianYearMonth(at('2026-09-12'))).toEqual({ year: 2019, month: 1 });
	});

	it('offsets the Gregorian year by 7 after new year and 8 before it', () => {
		expect(getEthiopianYearMonth(at('2026-11-20'))).toEqual({ year: 2019, month: 3 });
		expect(getEthiopianYearMonth(at('2026-01-15'))).toEqual({ year: 2018, month: 5 });
		expect(getEthiopianYearMonth(at('2025-12-25'))).toEqual({ year: 2018, month: 4 });
	});

	it('clamps Pagume to the last real month rather than reporting month 13', () => {
		// 6-10 September 2026 is Pagume 1-5 of 2018. Nothing bills against it.
		for (const day of ['06', '07', '08', '09', '10']) {
			expect(getEthiopianYearMonth(at(`2026-09-${day}`))).toEqual({ year: 2018, month: 12 });
		}
	});

	it('returns null for missing or invalid dates', () => {
		expect(getEthiopianYearMonth(null)).toBeNull();
		expect(getEthiopianYearMonth(undefined)).toBeNull();
		expect(getEthiopianYearMonth(new Date('nonsense'))).toBeNull();
	});
});

describe('currentEthiopianMonthParam', () => {
	it('builds the route segment for the month the date falls in', () => {
		// The regression this replaced: passing Gregorian numbers straight through gave
		// ሰኔ_2026 for this date, where the answer is ነሐሴ_2018.
		expect(decodeURIComponent(currentEthiopianMonthParam(at('2026-09-05')))).toBe('ነሐሴ_2018');
		expect(decodeURIComponent(currentEthiopianMonthParam(at('2026-09-11')))).toBe('መስከረም_2019');
		expect(decodeURIComponent(currentEthiopianMonthParam(at('2026-01-15')))).toBe('ጥር_2018');
	});

	it('never yields the Invalid Month segment, in any month of a Gregorian year', () => {
		for (let m = 0; m < 12; m++) {
			for (const day of [1, 15, 28]) {
				const segment = decodeURIComponent(
					currentEthiopianMonthParam(new Date(Date.UTC(2026, m, day, 12)))
				);
				expect(segment).not.toContain('Invalid');
				expect(segment).toMatch(/^[^_]+_\d{4}$/);
			}
		}
	});
});

describe('formatEthiopianYearMonth month names', () => {
	// Copied from the `month` mysqlEnum, which is identical on payment_request,
	// salaries, attendance and payroll. A redirect built from a name that is not on
	// this list matches no row, which is what ኅዳር / ታኅሣሥ used to do.
	const SCHEMA_MONTHS = [
		'መስከረም',
		'ጥቅምት',
		'ህዳር',
		'ታህሳስ',
		'ጥር',
		'የካቲት',
		'መጋቢት',
		'ሚያዝያ',
		'ግንቦት',
		'ሰኔ',
		'ሐምሌ',
		'ነሐሴ'
	];

	it('spells every month the way the schema enums do', () => {
		SCHEMA_MONTHS.forEach((name, index) => {
			expect(decodeURIComponent(formatEthiopianYearMonth(2018, index + 1))).toBe(`${name}_2018`);
		});
	});

	it('only ever emits a month name the schema would accept', () => {
		for (let m = 0; m < 12; m++) {
			const [name] = decodeURIComponent(
				currentEthiopianMonthParam(new Date(Date.UTC(2026, m, 15, 12)))
			).split('_');
			expect(SCHEMA_MONTHS).toContain(name);
		}
	});

	it('still rejects an out-of-range month', () => {
		expect(formatEthiopianYearMonth(2018, 13)).toBe('Invalid Month');
		expect(formatEthiopianYearMonth(2018, 0)).toBe('Invalid Month');
	});
});
