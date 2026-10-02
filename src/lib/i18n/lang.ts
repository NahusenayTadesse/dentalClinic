/**
 * The interface languages, and the cookie that carries the viewer's choice.
 *
 * Client-safe: the hook reads the cookie, the switch in the top bar writes it, and both need the
 * list. English is the default because it is what every screen spoke before Amharic existed, so a
 * viewer who never chooses sees no change.
 *
 * A cookie rather than a column on the user: reception desks here are usually one shared computer,
 * but the language is the desk's habit as much as the person's, and a cookie needs no migration
 * on better-auth's own table. If people start asking for it to follow them, that is the change.
 */
export const LANGS = ['en', 'am'] as const;

/** One of `LANGS`. */
export type Lang = (typeof LANGS)[number];

/** The cookie the choice is kept in. */
export const LANG_COOKIE = 'clinic_lang';

/** Whether a value — a cookie, a posted body — names a language this app speaks. */
export function isLang(value: unknown): value is Lang {
	return typeof value === 'string' && (LANGS as readonly string[]).includes(value);
}
