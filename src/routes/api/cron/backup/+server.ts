// Scheduled entry point for the daily backup, and for checking it restores.
//
// cPanel's cron calls it once a day, at night:
//
//   curl -fsS -H "Authorization: Bearer $BACKUP_CRON_SECRET" https://your-domain/api/cron/backup
//
// `?verify=1` also loads the new backup into a scratch database to prove it restores — worth doing
// weekly; it takes as long as a restore. See `$lib/server/backups.ts` and `$lib/server/cronAuth.ts`.
import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { requireCronSecret } from '$lib/server/cronAuth';
import { makeBackup, verifyLatest } from '$lib/server/backups';
import type { RequestHandler } from './$types';

async function handle(request: Request, url: URL) {
	requireCronSecret(request, url, env.BACKUP_CRON_SECRET, 'backup');
	try {
		const file = await makeBackup('cron');
		const verified = url.searchParams.get('verify') === '1' ? await verifyLatest('cron') : null;
		console.log(`[backup] ${file}${verified ? ' — verified' : ''}`);
		return json({ ok: true, file, verified });
	} catch (err: unknown) {
		const message = err instanceof Error ? err.message : 'Unknown error';
		console.error(`[backup] failed: ${message}`);
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
