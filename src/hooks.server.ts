import { building } from '$app/environment';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import type { Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { error } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';

import { auth } from '$lib/server/auth';
import { seedPermissions } from '$lib/server/seedPermissions';
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
import { PROTECTED_ROOT, ruleForPath } from '$lib/routeAccess';

/**
 * Blocks the public sign-up endpoint.
 *
 * `emailAndPassword` has to stay enabled — the admin panel creates accounts through
 * `auth.api.createUser` on the server, which does not pass through this HTTP route — but
 * without this, `POST /api/auth/sign-up/email` is an open registration form on a system holding
 * patient data.
 */
/**
 * Brings the `permissions` table up to date with the code, once per boot.
 *
 * `seedPermissions` used to run only at `/setup`, which is unreachable the moment an account
 * exists. So a permission added with a new route reached a fresh install and no other: on every
 * clinic already running, the row was never created, nobody could be granted it, and the route it
 * gated returned 403 to everyone — the super admin included, because holding "every permission"
 * cannot include one that has no row. Default-deny (§9) makes that failure total rather than
 * partial, which is why this has to exist alongside it.
 *
 * Idempotent and additive: it inserts the permissions that are missing and grants them to the
 * Super Admin role, which is what that role means. It removes nothing and renames nothing.
 *
 * Failure is logged and swallowed. A clinic whose permission sync failed should still be able to
 * open the app and be told what is wrong; refusing to boot would turn a missing row into an
 * outage.
 */
let permissionSyncStarted = false;

async function syncPermissionsOnce() {
	if (permissionSyncStarted || building) return;
	permissionSyncStarted = true;

	try {
		const result = await seedPermissions();

		if (result.permissionsCreated) {
			console.log(`[permissions] seeded ${result.permissionsCreated} new permission(s)`);
		}
	} catch (err) {
		console.error(
			`[permissions] sync failed: ${err instanceof Error ? err.message : 'Unknown error'}`
		);
	}
}

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
	// First request after a boot brings the permission table in step with the code. Awaited, and
	// only once, so the request that triggers it cannot read a half-seeded table.
	await syncPermissionsOnce();

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

		/*
		 * Closed by default under `/dashboard`.
		 *
		 * This used to refuse only what a rule claimed, so a path no rule matched was open to
		 * every account. With 96 pages against 22 rules that is not a theoretical gap: a new
		 * clinical route is readable by the whole clinic until somebody remembers to gate it, and
		 * nothing anywhere reports the omission. Refusing the unclaimed path turns forgetting a
		 * rule into a 403 on the first click.
		 *
		 * The two refusals say different things on purpose. "You lack the permission" is for the
		 * user and their admin; "no permission is defined" is for whoever built the page, and it
		 * is the only signal that the rule was never written.
		 */
		if (event.url.pathname.startsWith(PROTECTED_ROOT)) {
			const match = ruleForPath(event.url.pathname);

			if (!match) {
				error(
					403,
					'No permission is defined for this page, so it is closed. An administrator must add a rule for it.'
				);
			}

			if (match.permission !== null && !event.locals.permList.includes(match.permission)) {
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
