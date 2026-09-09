import { env } from '$env/dynamic/private';
import { betterAuth } from 'better-auth/minimal';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { admin } from 'better-auth/plugins';
import { getRequestEvent } from '$app/server';
import { APIError } from 'better-auth/api';
import { eq } from 'drizzle-orm';

import { db } from '$lib/server/db';
import * as schema from '$lib/server/db/schema/';
import { sendPasswordResetEmail } from '$lib/server/email';

/**
 * How long a reset link stays usable. An hour, matching better-auth's own default: long enough
 * for somebody to find the email on a phone and get to a machine.
 */
const RESET_EXPIRES_IN = 60 * 60;

export const auth = betterAuth({
	baseURL: env.ORIGIN,
	secret: env.BETTER_AUTH_SECRET,

	database: drizzleAdapter(db, {
		provider: 'mysql',
		// Without this, the adapter looks for its own table names and cannot see the columns
		// declared in `$lib/server/db/schema/user.ts`.
		schema
	}),

	// Password hashing is better-auth's default (scrypt). Nothing here pins parameters, so do not
	// reintroduce a custom hasher without a migration plan: existing `account.password` values
	// are only readable by the algorithm that wrote them.
	emailAndPassword: {
		enabled: true,

		sendResetPassword: async ({ user, url }) => {
			// An unguarded await here surfaces as a generic better-auth failure with no hint of
			// what went wrong, leaving the caller unsure whether an email is coming at all.
			try {
				await sendPasswordResetEmail(user.email, url, user.name);
			} catch (err) {
				console.error('Failed to send password reset email:', err);
				throw new Error('We could not send the reset email. Please try again in a moment.');
			}
		},
		resetPasswordTokenExpiresIn: RESET_EXPIRES_IN,

		/**
		 * A reset ends every other session. Someone resetting a password they believe is known has
		 * fixed nothing while the session on the machine that knew it is still open — and a person
		 * who has *forgotten* their password cannot be asked to judge whether that is the case.
		 */
		revokeSessionsOnPasswordReset: true
	},

	/**
	 * Throttling for `/api/auth/*`. The two endpoints singled out are the ones where a wrong
	 * answer is worth something: one guesses a password, the other mails an address of the
	 * caller's choosing from the clinic's own account.
	 *
	 * `enabled` is left at its default, which is production-only. `storage: 'memory'` is a real
	 * choice rather than a compromise while this runs as a single cPanel process — the database
	 * option wants a `rateLimit` table that does not exist.
	 */
	rateLimit: {
		window: 60,
		max: 60,
		storage: 'memory',
		customRules: {
			'/sign-in/email': { window: 5 * 60, max: 10 },
			'/forget-password': { window: 5 * 60, max: 5 }
		}
	},

	user: {
		/**
		 * Columns on `user` that are neither better-auth's own model nor supplied by a plugin.
		 * Declaring them here is what makes them readable off the session and settable through
		 * the sign-up and admin `createUser` APIs.
		 *
		 * `role`, `banned`, `banReason` and `banExpires` are deliberately absent — the admin
		 * plugin declares those itself, and repeating them here would collide.
		 *
		 * `input: false` on `isActive` is deliberate: it is an authorization flag, and anything
		 * with `input: true` can be set by whoever submits the sign-up form.
		 */
		additionalFields: {
			username: { type: 'string', required: false, input: true },
			roleId: { type: 'number', required: true, input: true },
			isActive: { type: 'boolean', required: false, input: false, defaultValue: true }
		}
	},

	databaseHooks: {
		session: {
			create: {
				/**
				 * The admin plugin already refuses sign-in for a banned user, but it knows nothing
				 * about `isActive` or `deletedAt`, so without this a deactivated or soft-deleted
				 * user signs in normally. The old login action checked `isActive` but not
				 * `deletedAt`; this closes both.
				 */
				before: async (session) => {
					const [row] = await db
						.select({ isActive: schema.user.isActive, deletedAt: schema.user.deletedAt })
						.from(schema.user)
						.where(eq(schema.user.id, session.userId))
						.limit(1);

					if (!row || row.deletedAt !== null || !row.isActive) {
						throw new APIError('UNAUTHORIZED', { message: 'This account is not active.' });
					}

					return { data: session };
				}
			}
		}
	},

	plugins: [
		/**
		 * Gates its endpoints on `user.role` against `adminRoles` — which is a different question
		 * from `locals.isSuperAdmin`, the app's own gate derived from the `permissions` table.
		 * A user needs `role: 'admin'` here *and* the matching application permissions to both
		 * manage accounts and use the pages that act on them.
		 *
		 * Everyone is created as `'user'`, which is not in `adminRoles`, so no account reaches the
		 * admin endpoints by default. The bootstrap seed is what grants the first `'admin'`.
		 */
		admin({ defaultRole: 'user', adminRoles: ['admin'] }),

		sveltekitCookies(getRequestEvent) // must stay last in the array
	]
});

export type Session = typeof auth.$Infer.Session.session;
export type User = typeof auth.$Infer.Session.user;
