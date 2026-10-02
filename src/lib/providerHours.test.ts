import { describe, expect, it } from 'vitest';
import { availabilityWarnings, type ProviderAvailability } from './providerHours';

// 2026-10-05 is a Monday, 2026-10-10 a Saturday.
const monday = '2026-10-05';
const saturday = '2026-10-10';

const weekdays: ProviderAvailability = {
	name: 'Dr Hana',
	hours: [0, 1, 2, 3, 4].map((weekDay) => ({ weekDay, start: '08:30:00', end: '17:00:00' })),
	leave: []
};

describe('availabilityWarnings', () => {
	it('lets through a slot inside the hours, to the minute', () => {
		expect(availabilityWarnings(weekdays, monday, '08:30', 30)).toEqual([]);
		expect(availabilityWarnings(weekdays, monday, '16:30', 30)).toEqual([]);
	});

	it('warns of a slot that starts early or runs late', () => {
		expect(availabilityWarnings(weekdays, monday, '08:00', 30)).toEqual([
			'Dr Hana works 08:30–17:00 on Mondays, and this runs outside those hours.'
		]);
		expect(availabilityWarnings(weekdays, monday, '16:45', 30)).toHaveLength(1);
	});

	it('warns of a day with no hours once any hours exist', () => {
		expect(availabilityWarnings(weekdays, saturday, '10:00', 30)).toEqual([
			'Dr Hana does not work on Saturdays.'
		]);
	});

	it('says nothing for a dentist whose hours were never entered', () => {
		expect(availabilityWarnings({ ...weekdays, hours: [] }, saturday, '22:00', 30)).toEqual([]);
	});

	it('reads a split day as either stretch, but not the gap between', () => {
		const split: ProviderAvailability = {
			...weekdays,
			hours: [
				{ weekDay: 0, start: '14:00', end: '18:00' },
				{ weekDay: 0, start: '08:00', end: '12:00' }
			]
		};
		expect(availabilityWarnings(split, monday, '09:00', 60)).toEqual([]);
		expect(availabilityWarnings(split, monday, '14:00', 60)).toEqual([]);
		expect(availabilityWarnings(split, monday, '11:30', 60)).toEqual([
			'Dr Hana works 08:00–12:00 and 14:00–18:00 on Mondays, and this runs outside those hours.'
		]);
	});

	it('warns of approved leave covering the day, on its first and last days too', () => {
		const away = { ...weekdays, leave: [{ from: '2026-10-05', to: '2026-10-07' }] };
		for (const day of ['2026-10-05', '2026-10-06', '2026-10-07']) {
			expect(availabilityWarnings(away, day, '10:00', 30)).toEqual([
				'Dr Hana is on approved leave that day.'
			]);
		}
		expect(availabilityWarnings(away, '2026-10-08', '10:00', 30)).toEqual([]);
	});

	it('warns of leave even when no hours were entered', () => {
		const away = { ...weekdays, hours: [], leave: [{ from: monday, to: monday }] };
		expect(availabilityWarnings(away, monday, '10:00', 30)).toHaveLength(1);
	});
});
