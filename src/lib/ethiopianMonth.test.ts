import { describe, expect, it } from 'vitest';
import { monthPeriod, monthPeriodFromParam } from './ethiopianMonth';

describe('monthPeriod', () => {
	it('runs an ordinary month from its first day to the eve of the next', () => {
		expect(monthPeriod(1, 2019)).toEqual({
			month: 1,
			year: 2019,
			start: '2026-09-11',
			end: '2026-10-10'
		});
	});

	it('runs Nehase on through Pagume, five days or six', () => {
		// 2018 has a five-day Pagume: Meskerem 1, 2019 is 11 September.
		expect(monthPeriod(12, 2018)).toMatchObject({ start: '2026-08-07', end: '2026-09-10' });
		// 2015 was a leap year: Pagume had six days, and Meskerem 1, 2016 fell on 12 September.
		expect(monthPeriod(12, 2015)).toMatchObject({ start: '2023-08-07', end: '2023-09-11' });
	});

	it('reads the month picker’s parameter, and refuses one that names no month', () => {
		expect(monthPeriodFromParam('መስከረም_2019')).toMatchObject({ month: 1, year: 2019 });
		expect(monthPeriodFromParam('ነሐሴ_2018')).toMatchObject({ month: 12, year: 2018 });
		expect(monthPeriodFromParam('September_2019')).toBeNull();
		expect(monthPeriodFromParam('መስከረም_')).toBeNull();
		expect(monthPeriodFromParam(null)).toBeNull();
	});
});
