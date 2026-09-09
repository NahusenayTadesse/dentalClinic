import { and, eq } from 'drizzle-orm';
import { notDeleted } from '$lib/server/softDelete';
import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { db } from '$lib/server/db';
import { user, roles, backup } from '$lib/server/db/schema/';

export const load: LayoutServerLoad = async ({ locals }) => {
	if (!locals.user) {
		redirect(302, '/login');
	}

	const [{ lastDownload }] = await db
		.select({ lastDownload: backup.lastDownload })
		.from(backup)
		.limit(1);

	const backupInfo = lastDownload ? new Date(lastDownload) : null;

	const isGreater7 = backupInfo
		? new Date().getTime() - backupInfo.getTime() > 7 * 24 * 60 * 60 * 1000
		: false;
	const dbUser = await db
		.select({
			id: user.id,
			roleName: roles.name,
			name: user.name
		})
		.from(user)
		.innerJoin(roles, and(eq(user.roleId, roles.id), notDeleted(roles)))
		.where(eq(user.id, locals.user.id))
		.then((r) => r[0]);

	return {
		permList: locals.permList,
		isSuperAdmin: locals.isSuperAdmin,
		role: dbUser,
		download: isGreater7
	};
};
