import { describe, it, expect } from 'vitest';
import { completedServiceYears, daysForServiceYear } from './leaveAccrual';

const brackets = [
	{ fromYears: 1, toYears: 2, days: 16 },
	{ fromYears: 3, toYears: 4, days: 17 },
	{ fromYears: 5, toYears: 6, days: 18 },
	{ fromYears: 7, toYears: 9, days: 19 },
	{ fromYears: 10, toYears: null, days: 20 }
];

describe('daysForServiceYear', () => {
	it('matches the bracket covering the service year', () => {
		expect(daysForServiceYear(brackets, 1)).toBe(16);
		expect(daysForServiceYear(brackets, 2)).toBe(16);
		expect(daysForServiceYear(brackets, 3)).toBe(17);
		expect(daysForServiceYear(brackets, 9)).toBe(19);
	});

	it('treats a null ending year as open ended', () => {
		expect(daysForServiceYear(brackets, 10)).toBe(20);
		expect(daysForServiceYear(brackets, 40)).toBe(20);
	});

	it('returns null when no bracket covers the year', () => {
		expect(daysForServiceYear(brackets, 0)).toBeNull();
		expect(daysForServiceYear([], 5)).toBeNull();
	});

	it('lets a narrower bracket override a catch-all', () => {
		const withOverride = [...brackets, { fromYears: 12, toYears: 12, days: 30 }];
		expect(daysForServiceYear(withOverride, 12)).toBe(30);
		expect(daysForServiceYear(withOverride, 13)).toBe(20);
	});
});

describe('completedServiceYears', () => {
	const asOf = new Date('2026-08-12');

	it('counts anniversaries that have already passed', () => {
		expect(completedServiceYears('2020-01-15', asOf)).toBe(6);
		expect(completedServiceYears('2025-08-12', asOf)).toBe(1);
	});

	it('does not count an anniversary that has not arrived yet', () => {
		expect(completedServiceYears('2025-08-13', asOf)).toBe(0);
		expect(completedServiceYears('2026-08-11', asOf)).toBe(0);
	});

	it('is zero for someone hired after the reference date', () => {
		expect(completedServiceYears('2026-08-13', asOf)).toBe(-1);
	});
});
