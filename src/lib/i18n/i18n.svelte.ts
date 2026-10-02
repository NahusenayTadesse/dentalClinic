import { getContext, setContext } from 'svelte';
import { MESSAGES, type Messages } from './messages';
import type { Lang } from './lang';

/**
 * The viewer's language, for any component below the root layout.
 *
 *     const t = useI18n();
 *     <h1>{t.m.reminders.title}</h1>
 *
 * **Svelte context, not module state**, for the reason `viewer.svelte.ts` gives: a module is shared
 * by every request the server renders, so a language stored there would be one concurrent request
 * away from rendering the wrong one. **A getter, read at render**, so switching language re-renders
 * what reads `t.m` without anything being re-created. Column definitions are built from `t.m`
 * inside a `$derived` for the same reason.
 *
 * Outside any tree that set it (a test rendering one component) it is English.
 */
const KEY = Symbol('i18n');

/** Called once, by the root layout, with the request's language. */
export function setLanguage(get: () => Lang) {
	setContext(KEY, get);
}

/** The viewer's language and its messages. Call during component setup. */
export function useI18n(): { readonly lang: Lang; readonly m: Messages } {
	const get = getContext<(() => Lang) | undefined>(KEY) ?? (() => 'en');
	return {
		get lang() {
			return get();
		},
		get m() {
			return MESSAGES[get()];
		}
	};
}
