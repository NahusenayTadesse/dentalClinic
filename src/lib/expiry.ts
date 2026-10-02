/**
 * How long something dated has left: a clinician's licence, a lot of anaesthetic on the shelf.
 *
 * Client-safe and pure. It began as the providers screen's licence helper; stock lots needed the
 * same four states, and a second copy of the day arithmetic is where an off-by-one would slip in
 * on one side only. "Expiring soon" is a state of its own because the reader should not have to
 * work it out from a date — the window is the caller's, since two months is time to renew a
 * licence and three is time to use up a box.
 *
 * Non-goal: deciding what an expired thing means. A licence that has lapsed and a lot that has
 * gone off are handled by their own screens; this only says which state they are in.
 */
import { clinicToday } from './clinicTime';

/**
 * How far ahead a stock lot counts as expiring. Three months is the window to use a box up, move it
 * to the busier chair, or ask the supplier to swap it, before it has to be written off. Shared by
 * the item's lot list and the dashboard's warning, so both call the same box "expiring".
 */
export const LOT_WARNING_DAYS = 90;

export type ExpiryState =
	| { kind: 'none' }
	| { kind: 'expired'; on: string; days: number }
	| { kind: 'expiring'; on: string; days: number }
	| { kind: 'valid'; on: string; days: number };

/**
 * The state of something that expires on `expiresOn`, warning `warningDays` ahead. Something that
 * expires today is not yet expired; yesterday, it is.
 *
 * `today` defaults to the clinic's own date rather than the UTC one, which is a day behind in
 * Addis Ababa between midnight and three in the morning. It is injectable so tests do not depend
 * on the day they run.
 */
export function expiryState(
	expiresOn: string | Date | null | undefined,
	warningDays: number,
	today: string | Date = clinicToday()
): ExpiryState {
	if (!expiresOn) return { kind: 'none' };

	const on = new Date(expiresOn);
	const now = new Date(today);
	if (Number.isNaN(on.getTime())) return { kind: 'none' };

	// Whole days, counted from midnight to midnight so "today" is 0 rather than a fraction.
	const day = 86_400_000;
	const days = Math.round(
		(Date.UTC(on.getUTCFullYear(), on.getUTCMonth(), on.getUTCDate()) -
			Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())) /
			day
	);
	const iso = on.toISOString();

	if (days < 0) return { kind: 'expired', on: iso, days };
	if (days <= warningDays) return { kind: 'expiring', on: iso, days };
	return { kind: 'valid', on: iso, days };
}
