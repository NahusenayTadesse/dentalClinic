import { describe, expect, it } from 'vitest';
import {
	addClinicDays,
	clinicClock,
	clinicDate,
	clinicDayRange,
	clinicMinutes,
	ethiopianClock,
	fromClinic,
	isIsoDate
} from './clinicTime';
import { canMove, isLive, isMovable } from './appointmentStatus';

/*
 * These pass whatever timezone the test process runs in — run them with TZ=UTC and
 * TZ=America/New_York as well as locally. That independence is the whole point of the module.
 */
describe('clinic time', () => {
	it('builds and reads back 9:00 in Addis as 06:00 UTC', () => {
		const nine = fromClinic('2026-09-13', '09:00');
		expect(nine.toISOString()).toBe('2026-09-13T06:00:00.000Z');
		expect(clinicClock(nine)).toBe('09:00');
		expect(clinicDate(nine)).toBe('2026-09-13');
		expect(clinicMinutes(nine)).toBe(540);
	});

	it('keeps a time just after local midnight on its local day, not the UTC one', () => {
		const early = fromClinic('2026-09-13', '01:30');
		expect(early.toISOString()).toBe('2026-09-12T22:30:00.000Z');
		expect(clinicDate(early)).toBe('2026-09-13');
	});

	it('bounds a clinic day by local midnights', () => {
		const { start, end } = clinicDayRange('2026-09-13');
		expect(start.toISOString()).toBe('2026-09-12T21:00:00.000Z');
		expect(end.toISOString()).toBe('2026-09-13T21:00:00.000Z');
	});

	it('moves dates across month ends', () => {
		expect(addClinicDays('2026-09-30', 1)).toBe('2026-10-01');
		expect(addClinicDays('2026-03-01', -1)).toBe('2026-02-28');
	});

	it('rejects dates that are not real', () => {
		expect(isIsoDate('2026-02-30')).toBe(false);
		expect(isIsoDate('13-09-2026')).toBe(false);
		expect(isIsoDate('2026-09-13')).toBe(true);
	});

	it('says the Ethiopian hour six behind the international one', () => {
		expect(ethiopianClock(fromClinic('2026-09-13', '09:00'))).toBe('ጠዋት 3:00');
		expect(ethiopianClock(fromClinic('2026-09-13', '13:30'))).toBe('ከሰዓት 7:30');
		expect(ethiopianClock(fromClinic('2026-09-13', '07:00'))).toBe('ጠዋት 1:00');
	});
});

describe('appointment status moves', () => {
	it('allows the ordinary day and the walk-in shortcut', () => {
		expect(canMove('scheduled', 'confirmed')).toBe(true);
		expect(canMove('scheduled', 'arrived')).toBe(true);
		expect(canMove('arrived', 'inChair')).toBe(true);
		expect(canMove('inChair', 'completed')).toBe(true);
	});

	it('keeps finished appointments finished', () => {
		expect(canMove('completed', 'scheduled')).toBe(false);
		expect(canMove('cancelled', 'scheduled')).toBe(false);
		expect(canMove('noShow', 'arrived')).toBe(false);
		// Once in the chair the patient cannot be a no-show.
		expect(canMove('inChair', 'noShow')).toBe(false);
	});

	it('knows which appointments still hold their chair, and which can move', () => {
		expect(isLive('arrived')).toBe(true);
		expect(isLive('cancelled')).toBe(false);
		expect(isMovable('confirmed')).toBe(true);
		expect(isMovable('arrived')).toBe(false);
	});
});
