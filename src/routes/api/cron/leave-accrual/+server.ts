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
import { json } from '@sveltejs/kit';
import { requireCronSecret } from '$lib/server/cronAuth';
import { env } from '$env/dynamic/private';
import { runLeaveJob } from '$lib/server/leaveJob';
import type { RequestHandler } from './$types';

async function handle(request: Request, url: URL) {
	requireCronSecret(request, url, env.LEAVE_CRON_SECRET, 'leave-accrual');

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
