import { describe, expect, it } from 'vitest';
import { licenceState } from './licence';

/**
 * The boundaries are the point: a licence that expires today is not expired, and one that expired
 * yesterday is — an off-by-one here would tell a clinic a clinician may still practise.
 */
const today = new Date('2026-09-24T09:00:00Z');

describe('licenceState', () => {
	it('says nothing is recorded when there is no date', () => {
		expect(licenceState(null, today).kind).toBe('none');
		expect(licenceState('', today).kind).toBe('none');
		expect(licenceState('not a date', today).kind).toBe('none');
	});

	it('counts a licence expiring today as still valid, and yesterday as expired', () => {
		expect(licenceState('2026-09-24', today)).toMatchObject({ kind: 'expiring', days: 0 });
		expect(licenceState('2026-09-23', today)).toMatchObject({ kind: 'expired', days: -1 });
	});

	it('warns inside the window and not outside it', () => {
		expect(licenceState('2026-11-23', today)).toMatchObject({ kind: 'expiring', days: 60 });
		expect(licenceState('2026-11-24', today)).toMatchObject({ kind: 'valid', days: 61 });
	});

	it('ignores the time of day on either side', () => {
		expect(licenceState(new Date('2026-09-25T23:00:00Z'), today)).toMatchObject({ days: 1 });
	});
});
