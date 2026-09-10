import {
	mysqlTable,
	varchar,
	text,
	timestamp,
	int,
	boolean,
	datetime,
	index,
	uniqueIndex,
	type AnyMySqlColumn
} from 'drizzle-orm/mysql-core';
import { relations, sql } from 'drizzle-orm';
import { branch } from './branches';
// From the leaf module, not `./branches`: `.default()` runs at module load and this file sits
// in an import cycle with that one. See `mainBranch.ts`.
import { MAIN_BRANCH_ID } from './mainBranch';

/**
 * Identity is owned by better-auth; `user`, `session`, `account` and `verification` carry the
 * columns it requires. They are declared here rather than in a generated file because `user`
 * also carries this app's own columns — `username`, `isActive`, `roleId` and the soft-delete
 * pair — and `npm run auth:schema` would overwrite them on every regeneration.
 *
 * Anything added here that better-auth must see (read back on the session, or accept at sign-up)
 * has to be declared a second time under `user.additionalFields` in `$lib/server/auth`.
 *
 * `id` is `varchar(255)`, not the generator's `varchar(36)`. Eighty tables reference `user.id`
 * through the `secureFields`/`lesserFields`/`approvalFields` mixins, and every one of those
 * columns is `varchar(255)`; MySQL refuses a foreign key whose types differ, so narrowing this
 * column would fail at `db:push` rather than at runtime.
 */
export const user = mysqlTable(
	'user',
	{
		id: varchar('id', { length: 255 }).primaryKey(),

		// better-auth core.
		name: varchar('name', { length: 255 }).notNull(),
		email: varchar('email', { length: 255 }).notNull().unique(),
		emailVerified: boolean('email_verified').default(false).notNull(),
		image: text('image'),

		/**
		 * Derived from the linked employee at creation, not supplied by the person signing up.
		 * Nullable because better-auth writes the row before the admin flow fills this in.
		 */
		username: varchar('username', { length: 32 }).unique(),

		/**
		 * Business state, and the gate the sign-in hook checks. Kept distinct from `deletedAt`:
		 * a deactivated user is meant to come back, a deleted one is not. Also distinct from
		 * `banned` below — see the note there.
		 */
		isActive: boolean('is_active').default(true).notNull(),

		/**
		 * better-auth's admin plugin. This is *not* `roleId`, and the two are not interchangeable:
		 *
		 *   `role`   — a plain string this app never reads, checked by the plugin against its
		 *              `adminRoles` list to decide who may call the admin endpoints
		 *              (createUser, listUsers, banUser, impersonate, revokeUserSessions).
		 *   `roleId` — the FK into `roles`, which is what `permList` and every route guard in
		 *              `routeAccess.ts` are actually derived from.
		 *
		 * Granting `role: 'admin'` therefore confers no application permission whatsoever, and
		 * holding every application permission confers no access to the admin endpoints. Keep
		 * both in mind when provisioning a user.
		 */
		role: varchar('role', { length: 64 }),
		/**
		 * Set by the admin plugin, which refuses sign-in while it is true and clears it once
		 * `banExpires` passes. It overlaps `isActive` — both stop a sign-in — so pick one meaning
		 * per situation: `banned` for a punitive, reversible, plugin-managed block, `isActive`
		 * for ordinary "this person no longer works here" deactivation.
		 */
		banned: boolean('banned').default(false),
		banReason: text('ban_reason'),
		/** `datetime`, not `timestamp`: a ban expiry should not be timezone-shifted or hit 2038. */
		banExpires: datetime('ban_expires'),

		/**
		 * `restrict` on purpose. `usersOnRole()` in `$lib/server/softDelete` refuses to delete a
		 * role somebody still holds; `set null` would let the delete through and leave that user
		 * with an empty `permList` — locked out of every page rather than blocked at the source.
		 */
		roleId: int('role_id')
			.references((): AnyMySqlColumn => roles.id, { onDelete: 'restrict' })
			.notNull(),

		/**
		 * Which location this account works at. Declared inline rather than spread from
		 * `branchRef()`, and annotated `AnyMySqlColumn` for the same reason `roleId` above is:
		 * `branch` carries `secureFields`, which references this table, so the two types are
		 * mutually recursive. The annotation cuts that — without it TypeScript gives up and
		 * infers `any` for the whole `branch` table.
		 */
		branchId: int('branch_id')
			.default(MAIN_BRANCH_ID)
			.references((): AnyMySqlColumn => branch.id, { onDelete: 'set null' }),

		createdAt: timestamp('created_at', { fsp: 3 }).defaultNow().notNull(),
		updatedAt: timestamp('updated_at')
			.default(sql`CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3)`)
			.notNull(),

		// Declared inline rather than spread from `deletionFields`: that module imports this one,
		// so spreading it here would close an import cycle. No FK on `deleted_by` — it would point
		// back at this same table, and a self-referencing constraint buys nothing over the column.
		deletedAt: datetime('deleted_at'),
		deletedBy: varchar('deleted_by', { length: 255 })
	},
	(table) => [index('name_idx').on(table.name)]
);

export const session = mysqlTable(
	'session',
	{
		id: varchar('id', { length: 255 }).primaryKey(),
		/** The value in the cookie. better-auth looks sessions up by this, so it must be indexed. */
		token: varchar('token', { length: 255 }).notNull().unique(),
		userId: varchar('user_id', { length: 255 })
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		expiresAt: datetime('expires_at').notNull(),
		ipAddress: text('ip_address'),
		userAgent: text('user_agent'),
		createdAt: timestamp('created_at', { fsp: 3 }).defaultNow().notNull(),
		updatedAt: timestamp('updated_at')
			.default(sql`CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3)`)
			.notNull(),

		/**
		 * The admin who opened this session by impersonating someone. No foreign key: the column
		 * is audit evidence, and an `on delete` rule of either kind would erase the record of who
		 * impersonated whom precisely when it matters. Same reasoning as `user.deletedBy`.
		 */
		impersonatedBy: varchar('impersonated_by', { length: 255 })
	},
	// Revoking every session for one user is a routine write here — `softDeleteUser`, the
	// force-logout on user edit, and a password change all do it.
	(table) => [index('session_user_id_idx').on(table.userId)]
);

/**
 * Credential and OAuth links. A password sign-in stores its argon2 hash in `password` on the row
 * whose `providerId` is `credential` — this is where `user.password_hash` went.
 */
export const account = mysqlTable(
	'account',
	{
		id: varchar('id', { length: 255 }).primaryKey(),
		// varchar rather than the generator's `text`: every credential sign-in looks a row up by
		// this pair, and MySQL cannot put a plain index on a TEXT column without a prefix length.
		accountId: varchar('account_id', { length: 255 }).notNull(),
		providerId: varchar('provider_id', { length: 255 }).notNull(),
		userId: varchar('user_id', { length: 255 })
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		accessToken: text('access_token'),
		refreshToken: text('refresh_token'),
		idToken: text('id_token'),
		accessTokenExpiresAt: datetime('access_token_expires_at'),
		refreshTokenExpiresAt: datetime('refresh_token_expires_at'),
		scope: text('scope'),
		password: text('password'),
		createdAt: timestamp('created_at', { fsp: 3 }).defaultNow().notNull(),
		updatedAt: timestamp('updated_at')
			.default(sql`CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3)`)
			.notNull()
	},
	(table) => [
		index('account_user_id_idx').on(table.userId),
		uniqueIndex('account_provider_account_idx').on(table.providerId, table.accountId)
	]
);

/** Short-lived tokens: password resets, and email verification if it is ever switched on. */
export const verification = mysqlTable(
	'verification',
	{
		id: varchar('id', { length: 255 }).primaryKey(),
		identifier: varchar('identifier', { length: 255 }).notNull(),
		value: text('value').notNull(),
		expiresAt: datetime('expires_at').notNull(),
		createdAt: timestamp('created_at', { fsp: 3 }).defaultNow().notNull(),
		updatedAt: timestamp('updated_at')
			.default(sql`CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3)`)
			.notNull()
	},
	(table) => [index('verification_identifier_idx').on(table.identifier)]
);

export const roles = mysqlTable('roles', {
	id: int('id').autoincrement().primaryKey(),
	name: varchar('name', { length: 32 }).notNull().unique(),
	description: varchar('description', { length: 255 }),
	isActive: boolean('is_active').default(true).notNull(),
	// See the note on `user` above for why these are not spread in. `notDeleted(roles)` in
	// `hooks.server.ts` reads `deletedAt` on every request, so it cannot be dropped.
	deletedAt: datetime('deleted_at'),
	deletedBy: varchar('deleted_by', { length: 255 }).references((): AnyMySqlColumn => user.id, {
		onDelete: 'set null'
	})
});

export const userRelations = relations(user, ({ one, many }) => ({
	role: one(roles, { fields: [user.roleId], references: [roles.id] }),
	sessions: many(session),
	accounts: many(account)
}));

export const sessionRelations = relations(session, ({ one }) => ({
	user: one(user, { fields: [session.userId], references: [user.id] })
}));

export const accountRelations = relations(account, ({ one }) => ({
	user: one(user, { fields: [account.userId], references: [user.id] })
}));
