import { describe, expect, it } from 'vitest';
import { ethiopianToIso } from './ethiopianCalendar';

describe('ethiopianToIso', () => {
	it('puts the new year on the right day either side of a leap year', () => {
		expect(ethiopianToIso(2015, 13, 6)).toBe('2023-09-11');
		expect(ethiopianToIso(2016, 1, 1)).toBe('2023-09-12');
		expect(ethiopianToIso(2019, 1, 1)).toBe('2026-09-11');
		expect(ethiopianToIso(2020, 1, 1)).toBe('2027-09-12');
	});

	it('stays right after the Gregorian leap day', () => {
		// 1 Megabit 2016 — the library this replaced said 9 March.
		expect(ethiopianToIso(2016, 7, 1)).toBe('2024-03-10');
		expect(ethiopianToIso(2018, 7, 1)).toBe('2026-03-10');
	});
});
