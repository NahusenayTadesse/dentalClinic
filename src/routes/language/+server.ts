import { error } from '@sveltejs/kit';
import { LANG_COOKIE, isLang } from '$lib/i18n/lang';
import type { RequestHandler } from './$types';

/**
 * Sets the interface language: the switch in the top bar posts `{ lang }` here, then reloads the
 * page's data. Outside `/dashboard` so the sign-in page can use it too; it needs no permission
 * because a language is not access to anything. Readable by the server only — nothing in the
 * browser reads it back, the layout's data carries it.
 */
export const POST: RequestHandler = async ({ request, cookies }) => {
	const body: unknown = await request.json().catch(() => null);
	const lang = body && typeof body === 'object' && 'lang' in body ? body.lang : null;
	if (!isLang(lang)) error(400, 'Unknown language');
	cookies.set(LANG_COOKIE, lang, {
		path: '/',
		maxAge: 60 * 60 * 24 * 365,
		sameSite: 'lax',
		httpOnly: true
	});
	return new Response(null, { status: 204 });
};
