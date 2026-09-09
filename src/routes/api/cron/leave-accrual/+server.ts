// Scheduled entry point for annual leave accrual and expiry.
//
// cPanel's cron calls this once a day:
//
//   curl -fsS -H "Authorization: Bearer $LEAVE_CRON_SECRET" \
//        https://your-domain/api/cron/leave-accrual
//
// The secret travels in a header rather than the query string, so it stays out of access logs,
// proxy logs and Referer headers. An unauthenticated caller gets a plain 404 — the same response
// as any URL that does not exist — so probing cannot confirm the route is here.
import { error, json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { runLeaveJob } from '$lib/server/leaveJob';
import type { RequestHandler } from './$types';

/** Length-independent comparison, so timing cannot be used to recover the secret. */
function secretMatches(provided: string, expected: string): boolean {
	if (provided.length !== expected.length) return false;

	let diff = 0;
	for (let i = 0; i < provided.length; i++) {
		diff |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
	}
	return diff === 0;
}

function presentedSecret(request: Request, url: URL): string {
	const header = request.headers.get('authorization') ?? '';
	if (header.toLowerCase().startsWith('bearer ')) return header.slice(7).trim();

	// Fallback for cron setups that cannot send headers. Prefer the header — anything in a query
	// string ends up in logs.
	return url.searchParams.get('secret') ?? '';
}

async function handle(request: Request, url: URL) {
	const expected = env.LEAVE_CRON_SECRET;

	// A missing secret means the job is unconfigured; refuse rather than run wide open.
	if (!expected) {
		console.error('[leave-accrual] LEAVE_CRON_SECRET is not set — refusing to run');
		error(404, 'Not found');
	}

	if (!secretMatches(presentedSecret(request, url), expected)) {
		error(404, 'Not found');
	}

	try {
		const result = await runLeaveJob('cron');
		console.log(`[leave-accrual] ${result.summary}`);

		return json({ ok: true, ...result });
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Unknown error';
		console.error(`[leave-accrual] failed: ${message}`);

		// 500 so a curl with -f and cron's mailer both notice the failure.
		return json({ ok: false, error: message }, { status: 500 });
	}
}

export const GET: RequestHandler = async ({ request, url, setHeaders }) => {
	setHeaders({ 'cache-control': 'no-store' });
	return handle(request, url);
};

export const POST: RequestHandler = async ({ request, url, setHeaders }) => {
	setHeaders({ 'cache-control': 'no-store' });
	return handle(request, url);
};
