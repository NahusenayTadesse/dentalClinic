import { building } from '$app/environment';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import type { Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { error } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';

import { auth } from '$lib/server/auth';
import { leaveJobIsOverdue, runLeaveJob } from '$lib/server/leaveJob';
import { db } from '$lib/server/db';
import {
	user as userTable,
	rolePermissions,
	specialPermissions,
	roles,
	permissions
} from '$lib/server/db/schema/';
import { notDeleted } from '$lib/server/softDelete';
import { computeIsSuperAdmin } from '$lib/server/permissions';
import { routeRules } from '$lib/routeAccess';

/**
 * Blocks the public sign-up endpoint.
 *
 * `emailAndPassword` has to stay enabled — the admin panel creates accounts through
 * `auth.api.createUser` on the server, which does not pass through this HTTP route — but
 * without this, `POST /api/auth/sign-up/email` is an open registration form on a system holding
 * patient data.
 */
const handleBlockPublicSignup: Handle = async ({ event, resolve }) => {
	if (event.request.method === 'POST' && event.url.pathname.startsWith('/api/auth/sign-up')) {
		return new Response('Not found', { status: 404 });
	}

	return resolve(event);
};

/**
 * Resolves the session through better-auth, then derives the caller's permissions from it.
 *
 * The two halves have to run in this order and in one hook: the permission queries are keyed by
 * `user.id`, so anything that reads `locals.permList` is meaningless until the session is known.
 */
const handleAuth: Handle = async ({ event, resolve }) => {
	const result = await auth.api.getSession({ headers: event.request.headers });

	event.locals.user = result?.user ?? null;
	event.locals.session = result?.session ?? null;
	event.locals.permList = [];
	event.locals.isSuperAdmin = false;

	const userId = result?.user?.id;

	if (userId) {
		const [rolePerms, specialPerms] = await Promise.all([
			// A deleted role, or a deleted grant on one, must confer nothing — these
			// filters are what makes deleting either take effect on access.
			db
				.select({ name: permissions.name })
				.from(userTable)
				.innerJoin(roles, and(eq(userTable.roleId, roles.id), notDeleted(roles)))
				.innerJoin(
					rolePermissions,
					and(eq(roles.id, rolePermissions.roleId), notDeleted(rolePermissions))
				)
				.innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
				.where(and(eq(userTable.id, userId), notDeleted(userTable))),

			db
				.select({ name: permissions.name })
				.from(specialPermissions)
				.innerJoin(permissions, eq(specialPermissions.permissionId, permissions.id))
				.where(and(eq(specialPermissions.userId, userId), notDeleted(specialPermissions)))
		]);

		const mappedSpecialPerms = specialPerms.map((name) => name.name);
		const mappedRolePerms = rolePerms.map((name) => name.name);

		event.locals.permList = specialPerms.length ? mappedSpecialPerms : mappedRolePerms;
		event.locals.isSuperAdmin = await computeIsSuperAdmin(event.locals.permList);

		const match = routeRules.find((route) => event.url.pathname.startsWith(route.prefix));

		if (match) {
			const hasPermission = event.locals.permList.includes(match.permission);

			if (!hasPermission) {
				error(
					403,
					'You are Not allowed to view this page, talk to an admin to change your permissions'
				);
			}
		}
	}

	return resolve(event);
};

// Backstop for the leave accrual cron. If cPanel's scheduler stops firing — deleted entry, host
// migration, a silent failure — ordinary signed-in traffic notices and runs the job instead, so
// nobody quietly loses accrued days. The cron stays the primary trigger; this only catches gaps.
//
// The check is throttled in memory so it costs one query an hour per process at most, and the
// job is started without awaiting it, so the visitor who happens to trigger it waits on nothing.
const BACKSTOP_CHECK_INTERVAL_MS = 60 * 60 * 1000;

let lastBackstopCheck = 0;
let backstopRunning = false;

function maybeRunLeaveBackstop(event: Parameters<Handle>[0]['event']) {
	// Signed-in traffic only, so anonymous hits and bots cannot poke the job.
	if (!event.locals.user) return;

	if (event.url.pathname.startsWith('/api/cron')) return;
	if (backstopRunning) return;

	const now = Date.now();

	if (now - lastBackstopCheck < BACKSTOP_CHECK_INTERVAL_MS) return;

	lastBackstopCheck = now;
	backstopRunning = true;

	const userId = event.locals.user.id;

	void (async () => {
		try {
			if (await leaveJobIsOverdue()) {
				const result = await runLeaveJob('backstop', userId);

				console.log(`[leave-accrual] cron looked overdue, backstop ran: ${result.summary}`);
			}
		} catch (err) {
			console.error(
				`[leave-accrual] backstop failed: ${err instanceof Error ? err.message : 'Unknown error'}`
			);
		} finally {
			backstopRunning = false;
		}
	})();
}

const handleLeaveBackstop: Handle = async ({ event, resolve }) => {
	maybeRunLeaveBackstop(event);

	return resolve(event);
};

/** Serves better-auth's own endpoints under /api/auth. */
const handleBetterAuth: Handle = async ({ event, resolve }) =>
	svelteKitHandler({ event, resolve, auth, building });

export const handle = sequence(
	handleBlockPublicSignup,
	handleBetterAuth,
	handleAuth,
	handleLeaveBackstop
);
