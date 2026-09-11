import { eq, inArray } from 'drizzle-orm';

import { db } from '$lib/server/db';
import { branch, contactTypes, permissions, rolePermissions, roles } from '$lib/server/db/schema';
import { MAIN_BRANCH_ID } from '$lib/server/db/schema/branches';
import { routeRules } from '$lib/routeAccess';

/**
 * The permissions the system recognises, and the role that holds all of them.
 *
 * Deliberately does **not** create a user. A password hash committed to a repository is a
 * vulnerability with a long tail, and the first administrator is created instead at `/setup`,
 * through better-auth, so their credential is hashed exactly as any later one would be.
 *
 * Idempotent: every insert is guarded, so re-running changes nothing. Nothing here updates or
 * removes an existing row — permissions are edited in the admin panel once the system is up.
 */

/** The name of the role that holds every permission. Looked up by name; `roles` has no slug. */
export const SUPER_ADMIN_ROLE = 'Super Admin';

/**
 * Two permissions are enforced in code rather than by a route prefix, so `routeRules` alone
 * would miss them:
 *
 *   `approvals.override` — release a record you requested yourself (`approvals/[entity]`)
 *   `rejections.reopen`  — put a rejected record back in the queue (`rejections/[entity]`)
 *
 * Everything else is derived from `routeRules`, which is the single source of truth for route
 * gating (CLAUDE.md §9). Deriving rather than restating means a new gated route cannot ship
 * with a permission nobody can be granted.
 */
const CODE_ONLY_PERMISSIONS = ['approvals.override', 'rejections.reopen'] as const;

/** Human wording for the permission list in the admin panel. */
const DESCRIPTIONS: Record<string, string> = {
	'approvals.approve': 'Approve or reject records waiting in a queue',
	'approvals.override': 'Release a record you requested yourself — recorded as an override',
	'approvals.view': 'See what is waiting for approval',
	'attendance.manage': 'Record and correct attendance',
	'audit_logs.view': 'Read the audit trail',
	'customers.record': 'Maintain corporate billing customers',
	'employees.create_followup': 'Open and follow up employee records',
	'leaves.view_approved': 'See approved leave',
	'rejections.reopen': 'Put a rejected record back into its queue',
	'rejections.view': 'See rejected records',
	'reports.finance': 'Read the money and payroll reports',
	'reports.hr': 'Read the people and leave reports',
	'roles.manage': 'Create roles and decide what they may do',
	'salary.manage': 'Run payroll and manage salaries',
	'settings.manage': 'Change system settings, lookups and backups',
	'supplies_suppliers.manage': 'Maintain supplies and suppliers',
	'transactions.manage': 'Record transactions and expenses',
	'users.manage': 'Create and manage user accounts'
};

/** Every permission the system recognises, in a stable order. */
export function permissionNames(): string[] {
	const fromRoutes = routeRules.map((rule) => rule.permission);
	return [...new Set([...fromRoutes, ...CODE_ONLY_PERMISSIONS])].sort();
}

export type SeedResult = {
	permissionsCreated: number;
	permissionsTotal: number;
	roleCreated: boolean;
	grantsCreated: number;
};

/**
 * Creates the permission rows, the super-admin role, and the grants between them.
 *
 * The grant loop is not optional bookkeeping. `computeIsSuperAdmin` decides the status by
 * counting a user's permissions against the total in the table — so a role that holds all but
 * one is not a super admin, and every delete button in the app stays hidden. That is also why
 * adding a permission later demotes existing super admins until they are granted it.
 */
export async function seedPermissions(): Promise<SeedResult> {
	const names = permissionNames();

	const existing = await db
		.select({ name: permissions.name })
		.from(permissions)
		.where(inArray(permissions.name, names));

	const missing = names.filter((name) => !existing.some((row) => row.name === name));

	if (missing.length) {
		await db.insert(permissions).values(
			missing.map((name) => ({
				name,
				description: DESCRIPTIONS[name] ?? name
			}))
		);
	}

	const [role] = await db
		.select({ id: roles.id })
		.from(roles)
		.where(eq(roles.name, SUPER_ADMIN_ROLE))
		.limit(1);

	let roleId = role?.id;
	let roleCreated = false;

	if (!roleId) {
		await db.insert(roles).values({
			name: SUPER_ADMIN_ROLE,
			description: 'Holds every permission. Required for deletes and system settings.'
		});
		const [created] = await db
			.select({ id: roles.id })
			.from(roles)
			.where(eq(roles.name, SUPER_ADMIN_ROLE))
			.limit(1);
		roleId = created.id;
		roleCreated = true;
	}

	// Re-read rather than reuse `missing`: on a re-run the rows already exist, and the role
	// still has to end up holding all of them.
	const all = await db.select({ id: permissions.id }).from(permissions);
	const held = await db
		.select({ permissionId: rolePermissions.permissionId })
		.from(rolePermissions)
		.where(eq(rolePermissions.roleId, roleId));

	const heldIds = new Set(held.map((row) => row.permissionId));
	const toGrant = all.filter((row) => !heldIds.has(row.id));

	if (toGrant.length) {
		await db
			.insert(rolePermissions)
			.values(toGrant.map((row) => ({ roleId, permissionId: row.id })));
	}

	return {
		permissionsCreated: missing.length,
		permissionsTotal: all.length,
		roleCreated,
		grantsCreated: toGrant.length
	};
}

/**
 * Creates the main branch, if it does not exist.
 *
 * Every branch-aware table defaults `branch_id` to `MAIN_BRANCH_ID`, so that row has to exist
 * before the first insert or the foreign key rejects it. Most clinics run one location and
 * will never revisit this — that is the point of the default.
 *
 * The explicit `id` is what makes the default correct rather than merely likely: without it
 * MySQL would still assign 1 on a fresh database, but not on one that was seeded, cleared and
 * seeded again.
 *
 * Migration `0001` inserts the same row, and has to: it adds `branch_id DEFAULT 1` to tables
 * that may already hold rows, and MySQL backfills them with 1 before the foreign key is built —
 * which fails outright if no branch exists yet. This function is the other path, for a database
 * brought up with `db:push`, which runs no migrations at all. Both are idempotent, so whichever
 * runs second does nothing.
 */
export async function seedMainBranch(name = 'Main Branch') {
	const [existing] = await db
		.select({ id: branch.id })
		.from(branch)
		.where(eq(branch.id, MAIN_BRANCH_ID))
		.limit(1);

	if (existing) return;

	await db.insert(branch).values({ id: MAIN_BRANCH_ID, name });
}

/**
 * The contact channels a clinic starts with.
 *
 * Seeded rather than left to the admin panel because an empty picker on the first patient is a
 * dead end — the front desk has no reason to guess that Telegram is something they must create
 * before they can record it. These four are what people here actually use; anything else is a
 * row they add themselves, which is the point of the table.
 *
 * Inserted only when the table is completely empty, not row by row. A clinic that deliberately
 * deletes Telegram should not find it back after the next restart.
 */
export async function seedContactTypes() {
	const [existing] = await db.select({ id: contactTypes.id }).from(contactTypes).limit(1);

	if (existing) return;

	await db.insert(contactTypes).values([
		{ name: 'Phone', kind: 'phone', sortOrder: 1 },
		{ name: 'Email', kind: 'email', sortOrder: 2 },
		{ name: 'Telegram', kind: 'username', linkPrefix: 'https://t.me/', sortOrder: 3 },
		{ name: 'WhatsApp', kind: 'phone', linkPrefix: 'https://wa.me/', sortOrder: 4 }
	]);
}
