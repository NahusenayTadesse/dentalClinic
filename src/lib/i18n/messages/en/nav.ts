/**
 * Menu titles, keyed by their English title in `$lib/navigation.ts`.
 *
 * Keyed by the English rather than given keys of their own because the menu's logic — which group
 * is open, which link is lit — compares titles, and must keep doing so whatever language is drawn.
 * English needs no entries: a title with no translation is shown as written. `i18n.test.ts` fails on
 * any menu title missing from the Amharic list.
 */
export const nav: Record<string, string> = {};
