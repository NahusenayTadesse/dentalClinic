import { describe, expect, it } from 'vitest';
import { dayStatus, daysBetween, scheduleWeekday, summarise, type DayFacts } from './attendance';

/** A Wednesday, judged, scheduled 08:30–17:00, with nothing recorded and nothing else true. */
const facts = (change: Partial<DayFacts> = {}): DayFacts => ({
	day: '2026-09-30',
	today: '2026-10-02',
	judgedFrom: '2026-09-01',
	schedule: { start: '08:30:00', end: '17:00:00' },
	record: null,
	onLeave: false,
	closed: false,
	...change
});

describe('a day of attendance', () => {
	it('numbers weekdays Monday first, as the schedule form does', () => {
		expect(scheduleWeekday('2026-09-28')).toBe(0); // Monday
		expect(scheduleWeekday('2026-10-03')).toBe(5); // Saturday
		expect(scheduleWeekday('2026-10-04')).toBe(6); // Sunday
	});

	it('calls a scheduled day with nothing recorded an absence', () => {
		expect(dayStatus(facts()).kind).toBe('absent');
	});

	it('measures lateness, leaving early and hours worked against the schedule', () => {
		const day = dayStatus(
			facts({ record: { status: 'present', clockIn: '08:45', clockOut: '16:30', note: null } })
		);
		expect(day).toMatchObject({ kind: 'present', late: 15, early: 30, worked: 465, open: false });
	});

	it('leaves someone still in open, with nothing counted early', () => {
		const day = dayStatus(
			facts({ record: { status: 'present', clockIn: '08:20', clockOut: null, note: null } })
		);
		expect(day).toMatchObject({ kind: 'present', late: 0, early: 0, worked: 0, open: true });
	});

	it('does not count leave, a closure, an excuse or a day off as an absence', () => {
		expect(dayStatus(facts({ onLeave: true })).kind).toBe('leave');
		expect(dayStatus(facts({ closed: true })).kind).toBe('closed');
		expect(
			dayStatus(
				facts({ record: { status: 'excused', clockIn: null, clockOut: null, note: 'Sick' } })
			).kind
		).toBe('excused');
		expect(dayStatus(facts({ schedule: null })).kind).toBe('off');
	});

	it('judges nothing before the register started, nothing to come, and not today yet', () => {
		expect(dayStatus(facts({ judgedFrom: '2026-10-01' })).kind).toBe('unjudged');
		expect(dayStatus(facts({ judgedFrom: null })).kind).toBe('unjudged');
		expect(dayStatus(facts({ day: '2026-10-05' })).kind).toBe('unjudged');
		expect(dayStatus(facts({ day: '2026-10-02' })).kind).toBe('notYet');
	});

	it('counts work done on a day off as presence', () => {
		const day = dayStatus(
			facts({
				schedule: null,
				record: { status: 'present', clockIn: '09:00', clockOut: '12:00', note: null }
			})
		);
		expect(day).toMatchObject({ kind: 'present', worked: 180, late: 0 });
	});

	it('sums a range', () => {
		const days = daysBetween('2026-09-28', '2026-10-01').map((day) =>
			dayStatus(
				facts({
					day,
					record:
						day === '2026-09-29'
							? { status: 'present', clockIn: '08:40', clockOut: '17:00', note: null }
							: null
				})
			)
		);
		expect(summarise(days)).toMatchObject({ present: 1, absent: 3, late: 1, lateMinutes: 10 });
	});
});
