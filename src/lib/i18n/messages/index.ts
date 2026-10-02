/**
 * Every string the translated screens show, in each language, one module per area.
 *
 * **English is the shape.** `Messages` is the English object's type, and each Amharic area is typed
 * as its English twin, so a key missing from the Amharic, or a message taking the wrong values, is
 * a compile error rather than an English word appearing in an Amharic screen. The two exceptions
 * are `nav` (keyed by menu title, checked by `i18n.test.ts`) and `kit` (the kit's own type, where
 * a label left out falls back to the kit's English).
 *
 * In-house rather than a library, deliberately: two languages, messages that are plain strings or
 * small functions, and numbers and dates already formatted through `Intl`. A typed object is the
 * whole of what a library would give here, without a compile step in the build.
 *
 * Non-goals: validation messages in the form schemas, which are shared with the server and stay
 * English for now; and screens outside the front desk, which are translated area by area.
 */
import { common as enCommon } from './en/common';
import { nav as enNav } from './en/nav';
import { kit as enKit } from './en/kit';
import { help as enHelp } from './en/help';
import { appointments as enAppointments } from './en/appointments';
import { patients as enPatients } from './en/patients';
import { billing as enBilling } from './en/billing';
import { forms as enForms } from './en/forms';
import { common as amCommon } from './am/common';
import { nav as amNav } from './am/nav';
import { kit as amKit } from './am/kit';
import { help as amHelp } from './am/help';
import { appointments as amAppointments } from './am/appointments';
import { patients as amPatients } from './am/patients';
import { billing as amBilling } from './am/billing';
import { forms as amForms } from './am/forms';
import type { Lang } from '../lang';

const en = {
	common: enCommon,
	nav: enNav,
	kit: enKit,
	help: enHelp,
	appointments: enAppointments,
	patients: enPatients,
	billing: enBilling,
	forms: enForms
};

/** The messages of one language. */
export type Messages = typeof en;

const am: Messages = {
	common: amCommon,
	nav: amNav,
	kit: amKit,
	help: amHelp,
	appointments: amAppointments,
	patients: amPatients,
	billing: amBilling,
	forms: amForms
};

/** Every language's messages. */
export const MESSAGES: Record<Lang, Messages> = { en, am };

/**
 * The messages for a request's language, for a server action's reply:
 *
 *     return message(form, { type: 'success', text: messagesFor(event.locals.lang).appointments.booked });
 */
export function messagesFor(lang: Lang): Messages {
	return MESSAGES[lang];
}

/** A menu title in the viewer's language, or as written when it has no translation. */
export function navTitle(m: Messages, title: string): string {
	return m.nav[title] ?? title;
}
