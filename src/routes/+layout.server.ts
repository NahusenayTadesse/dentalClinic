import { loadFlash } from 'sveltekit-flash-message/server';
import type { LayoutServerLoad } from './$types';

/** The flash message, as before, and the viewer's language for every page below. */
export const load: LayoutServerLoad = loadFlash(async ({ locals }) => ({ lang: locals.lang }));
