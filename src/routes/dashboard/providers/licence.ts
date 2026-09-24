/**
 * How long a clinician's licence has left.
 *
 * Client-safe and pure, because three places ask: the table cell, the page's summary line, and the
 * test. A licence is a legal requirement to practise here, and an expired one is the kind of thing
 * a clinic discovers when an inspector asks — so "expiring soon" is a state of its own rather than
 * something a reader has to work out from a date.
 */

/** How far ahead a licence counts as expiring. Two months is time to start a renewal here. */
export const LICENCE_WARNING_DAYS = 60;

export type LicenceState =
	| { kind: 'none' }
	| { kind: 'expired'; on: string; days: number }
	| { kind: 'expiring'; on: string; days: number }
	| { kind: 'valid'; on: string; days: number };

/** `today` is injectable so the test does not depend on the day it runs. */
export function licenceState(
	expiresOn: string | Date | null | undefined,
	today: Date = new Date()
): LicenceState {
	if (!expiresOn) return { kind: 'none' };

	const on = new Date(expiresOn);
	if (Number.isNaN(on.getTime())) return { kind: 'none' };

	// Whole days, counted from midnight to midnight so "today" is 0 rather than a fraction.
	const day = 86_400_000;
	const days = Math.round(
		(Date.UTC(on.getUTCFullYear(), on.getUTCMonth(), on.getUTCDate()) -
			Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())) /
			day
	);
	const iso = on.toISOString();

	if (days < 0) return { kind: 'expired', on: iso, days };
	if (days <= LICENCE_WARNING_DAYS) return { kind: 'expiring', on: iso, days };
	return { kind: 'valid', on: iso, days };
}
