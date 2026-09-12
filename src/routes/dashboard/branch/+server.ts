import { json, error } from '@sveltejs/kit';
import { ALL_BRANCHES, BRANCH_COOKIE, resolveBranch } from '$lib/server/branchScope';
import type { RequestHandler } from './$types';

/**
 * Sets the branch the caller is working at.
 *
 * A POST rather than a link, because it changes state. The value is written to a cookie and
 * nothing else — the authority is `resolveBranch` in `hooks.server.ts`, which re-checks it on
 * every request. This endpoint therefore cannot grant access: setting the cookie to a branch the
 * user may not see simply gets ignored on the next request.
 *
 * It still validates before writing, so an impossible choice fails loudly here rather than
 * silently reverting on the next page — a selector that appears to work and does not is worse
 * than one that refuses.
 */
export const POST: RequestHandler = async ({ request, cookies, locals }) => {
	if (!locals.user) throw error(401, 'Not signed in.');

	const { branchId } = await request.json();
	const requested = String(branchId);

	const resolved = await resolveBranch(
		requested,
		locals.user.id,
		locals.permList,
		locals.isSuperAdmin
	);

	const wanted = requested === ALL_BRANCHES ? null : Number(requested);
	if (resolved.active !== wanted) {
		throw error(403, 'That branch is not available to you.');
	}

	cookies.set(BRANCH_COOKIE, requested, {
		path: '/',
		httpOnly: false, // the selector reads it to show its own state
		sameSite: 'lax',
		maxAge: 60 * 60 * 24 * 365
	});

	return json({ ok: true });
};
