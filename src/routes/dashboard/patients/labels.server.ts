import { ALERTS, isAlertKey } from '$lib/server/patients';
import type { Messages } from '$lib/i18n/messages';

/**
 * The patient screens' server-made labels, in the viewer's language.
 *
 * `flagsFor` and `possibleDuplicates` (`server/patients.ts`) speak English because every screen
 * reads them; the list, the chart header and registration translate what they show here, by the
 * value each label stands for, so a label nobody has translated is shown as it was written.
 */

/** A medicine alert, as `flagsFor` labels it (`ALERTS[…].label`), in the viewer's language. */
export function alertName(m: Messages, label: string): string {
	const key = Object.keys(ALERTS).find((k) => isAlertKey(k) && ALERTS[k].label === label);
	return key && isAlertKey(key) ? m.patients.alerts[key] : label;
}

/** Why a record may be the same person, as `possibleDuplicates` says it, in the viewer's language. */
export function duplicateReason(m: Messages, reason: string): string {
	return new Map(Object.entries(m.patients.duplicateReasons)).get(reason) ?? reason;
}
