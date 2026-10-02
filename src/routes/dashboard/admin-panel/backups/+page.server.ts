import { error, fail } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

import {
	BACKUP_JOB,
	KEEP,
	VERIFY_JOB,
	backupRuns,
	lastSuccess,
	listBackups,
	makeBackup,
	verifyLatest
} from '$lib/server/backups';
import type { Actions, PageServerLoad } from './$types';

/** How old the newest backup may get before the screen says so. */
const STALE_DAYS = 2;

/**
 * The backups on this server, when they last worked, and whether the newest one restores. Reading it
 * is the admin panel's `settings.manage`; making or verifying a backup is a super admin's, in the
 * action — a backup holds every record the clinic has.
 */
export const load: PageServerLoad = async ({ locals }) => {
	const [files, runs, lastBackup, lastVerify] = await Promise.all([
		listBackups(),
		backupRuns(),
		lastSuccess(BACKUP_JOB),
		lastSuccess(VERIFY_JOB)
	]);
	const newest = files[0]?.at ?? null;
	const ageDays = newest ? (Date.now() - newest.getTime()) / 86_400_000 : null;
	return {
		files,
		runs,
		lastBackup,
		lastVerify,
		stale: ageDays === null || ageDays > STALE_DAYS,
		staleDays: STALE_DAYS,
		keep: KEEP,
		copyConfigured: Boolean(env.BACKUP_COPY_DIR),
		cronConfigured: Boolean(env.BACKUP_CRON_SECRET),
		canRun: locals.isSuperAdmin
	};
};

/** Refuses anyone but a super admin, with a reason that fits a backup. */
function superAdminOnly(locals: App.Locals) {
	if (!locals.isSuperAdmin) error(403, 'Only a super administrator can make or check a backup.');
}

export const actions: Actions = {
	/** Backs up now. Can take a minute on a large database; the button says so while it runs. */
	backup: async ({ locals }) => {
		superAdminOnly(locals);
		try {
			const file = await makeBackup('manual');
			return { message: { type: 'success', text: `Backed up: ${file}` } };
		} catch (err: unknown) {
			const text = err instanceof Error ? err.message : 'The backup failed.';
			return fail(500, { message: { type: 'error', text: `The backup failed: ${text}` } });
		}
	},

	/** Loads the newest backup into a scratch database to prove it restores, then drops it. */
	verify: async ({ locals }) => {
		superAdminOnly(locals);
		try {
			const counts = await verifyLatest('manual');
			const said = Object.entries(counts)
				.map(([table, n]) => `${n} ${table}`)
				.join(', ');
			return { message: { type: 'success', text: `The newest backup restores: ${said}.` } };
		} catch (err: unknown) {
			const text = err instanceof Error ? err.message : 'The check failed.';
			return fail(500, { message: { type: 'error', text: `It did not restore: ${text}` } });
		}
	}
};
