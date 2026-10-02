import { describe, expect, it } from 'vitest';
import {
	ageOn,
	countInto,
	emptyTally,
	hmisBand,
	hmisPeriod,
	hmisPeriodFromParam,
	tallyTotals
} from './hmisReport';

describe('hmisPeriod', () => {
	it('runs an ordinary month from its first day to the eve of the next', () => {
		expect(hmisPeriod(1, 2019)).toEqual({
			month: 1,
			year: 2019,
			start: '2026-09-11',
			end: '2026-10-10'
		});
	});

	it('runs Nehase on through Pagume, five days or six', () => {
		// 2018 has a five-day Pagume: Meskerem 1, 2019 is 11 September.
		expect(hmisPeriod(12, 2018)).toMatchObject({ start: '2026-08-07', end: '2026-09-10' });
		// 2015 was a leap year: Pagume had six days, and Meskerem 1, 2016 fell on 12 September.
		expect(hmisPeriod(12, 2015)).toMatchObject({ start: '2023-08-07', end: '2023-09-11' });
	});

	it('reads the month picker’s parameter, and refuses one that names no month', () => {
		expect(hmisPeriodFromParam('መስከረም_2019')).toMatchObject({ month: 1, year: 2019 });
		expect(hmisPeriodFromParam('ነሐሴ_2018')).toMatchObject({ month: 12, year: 2018 });
		expect(hmisPeriodFromParam('September_2019')).toBeNull();
		expect(hmisPeriodFromParam('መስከረም_')).toBeNull();
		expect(hmisPeriodFromParam(null)).toBeNull();
	});
});

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
