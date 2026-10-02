/**
 * How long a clinician's licence has left.
 *
 * A licence is a legal requirement to practise here, and an expired one is the kind of thing a
 * clinic discovers when an inspector asks. The arithmetic is `$lib/expiry.ts`, shared with stock
 * lots; what belongs to licences is the warning window.
 */
import { expiryState, type ExpiryState } from '@nahu/admin-kit/expiry.js';

/** How far ahead a licence counts as expiring. Two months is time to start a renewal here. */
export const LICENCE_WARNING_DAYS = 60;

/** A licence's state. `today` is injectable so the test does not depend on the day it runs. */
export function licenceState(
	expiresOn: string | Date | null | undefined,
	today?: Date
): ExpiryState {
	return expiryState(expiresOn, LICENCE_WARNING_DAYS, today);
}
