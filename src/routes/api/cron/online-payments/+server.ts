// Scheduled check of online payments still waiting — for a gateway whose notification could not
// reach this server (a local install), or did not come. cPanel's cron, every ten minutes:
//
//   curl -fsS -H "Authorization: Bearer $PAYMENTS_CRON_SECRET" https://your-domain/api/cron/online-payments
//
// Each waiting payment of the last two days is asked about (`checkWaiting`); one not paid within a
// day is given up on. See `$lib/server/onlinePayments`.
import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { requireCronSecret } from '$lib/server/cronAuth';
import { checkWaiting } from '$lib/server/onlinePayments';
import type { RequestHandler } from './$types';

async function handle(request: Request, url: URL) {
	requireCronSecret(request, url, env.PAYMENTS_CRON_SECRET, 'online-payments');
	const counts = await checkWaiting();
	if (counts.asked) console.log(`[online-payments] asked ${counts.asked}, ${counts.paid} paid`);
	return json({ ok: true, ...counts });
}

export const GET: RequestHandler = async ({ request, url, setHeaders }) => {
	setHeaders({ 'cache-control': 'no-store' });
	return handle(request, url);
};

export const POST: RequestHandler = async ({ request, url, setHeaders }) => {
	setHeaders({ 'cache-control': 'no-store' });
	return handle(request, url);
};
