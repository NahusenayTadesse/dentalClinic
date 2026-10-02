import { describe, expect, it } from 'vitest';
import { ageOn, countInto, emptyTally, hmisBand, tallyTotals } from './hmisReport';

describe('age groups', () => {
	it('counts completed years on the day, not on the birthday’s year', () => {
		expect(ageOn('2020-10-05', '2026-10-04')).toBe(5);
		expect(ageOn('2020-10-05', '2026-10-05')).toBe(6);
	});

	it('puts each age in its column, edges included', () => {
		const day = '2026-10-05';
		expect(hmisBand('2026-03-01', day)).toBe('under1');
		expect(hmisBand('2025-10-05', day)).toBe('oneToFour');
		expect(hmisBand('2021-10-06', day)).toBe('oneToFour');
		expect(hmisBand('2021-10-05', day)).toBe('fiveToFourteen');
		expect(hmisBand('2011-10-05', day)).toBe('fifteenToTwentyNine');
		expect(hmisBand('1996-10-05', day)).toBe('thirtyToSixtyFour');
		expect(hmisBand('1961-10-05', day)).toBe('sixtyFivePlus');
	});

	it('counts a missing or impossible birth date as unknown, never as an infant', () => {
		expect(hmisBand(null, '2026-10-05')).toBe('unknown');
		expect(hmisBand('2027-01-01', '2026-10-05')).toBe('unknown');
	});
});

describe('tallies', () => {
	it('adds up by sex and altogether', () => {
		const tally = emptyTally();
		countInto(tally, 'under1', 'female');
		countInto(tally, 'sixtyFivePlus', 'male');
		countInto(tally, 'unknown', 'female');
		expect(tallyTotals(tally)).toEqual({ male: 1, female: 2, all: 3 });
	});
});
