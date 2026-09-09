import { varchar, datetime, timestamp, int, boolean, mysqlEnum } from 'drizzle-orm/mysql-core';
import { user } from './user';
import { sql } from 'drizzle-orm';

/**
 * The soft-delete marker. A row with a non-null `deletedAt` is deleted and must
 * never reach the frontend — see `notDeleted()` in `$lib/server/softDelete`.
 *
 * Kept separate from `isActive`/`status` on purpose: those are *business* state
 * that pages like `/contracts/inactive` deliberately list, so they cannot double
 * as a delete marker.
 *
 * Tables outside `secureFields`/`lesserFields` that need this (`user`, `roles`)
 * declare the same two columns inline instead of spreading this object, because
 * they live in `user.ts` and importing from here would close an import cycle.
 */
export const deletionFields = {
	deletedAt: datetime('deleted_at'),
	deletedBy: varchar('deleted_by', { length: 255 }).references(() => user.id, {
		onDelete: 'set null'
	})
};

export const secureFields = {
	isActive: boolean('is_active').default(true).notNull(),
	createdBy: varchar('created_by', { length: 255 }).references(() => user.id, {
		onDelete: 'set null'
	}),
	updatedBy: varchar('updated_by', { length: 255 }).references(() => user.id, {
		onDelete: 'set null'
	}),
	createdAt: timestamp('created_at').defaultNow().notNull(),
	updatedAt: timestamp('updated_at')
		.default(sql`CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3)`)
		.notNull(),
	...deletionFields
};

export const lesserFields = {
	status: boolean('status').default(true).notNull(),
	...deletionFields
};

/**
 * Maker-checker approval, for the tables where a record must be entered by one person and
 * released by another: payroll, contracts, salaries, expenses.
 *
 * `approvalStatus` is the single source of truth. The `*By` columns are evidence of who did
 * what, not state — without the enum, a row with both `approvedBy` and `rejectedBy` set has no
 * defined answer, and a row with all of them null is indistinguishable from one that never
 * entered the workflow.
 *
 * Named `approval_status` rather than `status` deliberately: `lesserFields.status` is a boolean,
 * and `payroll_entries`/`customers` already carry unrelated `status` enums of their own.
 *
 * `requestedBy` is usually the same person as `createdBy`, and is kept separate anyway so the
 * distinct-actor rule reads off the approval columns alone rather than depending on which of
 * them happens to be set.
 *
 * `approvalOverridden` records a release that a super admin pushed through despite being the
 * requester. It is derivable today — `requestedBy === approvedBy` — but only while both users
 * exist, and both columns are `set null` on user deletion, which would erase the evidence
 * precisely when it matters. Stored, not derived, for that reason.
 */
export const approvalFields = {
	approvalStatus: mysqlEnum('approval_status', ['pending', 'approved', 'rejected'])
		.notNull()
		.default('pending'),
	requestedBy: varchar('requested_by', { length: 255 }).references(() => user.id, {
		onDelete: 'set null'
	}),
	approvedBy: varchar('approved_by', { length: 255 }).references(() => user.id, {
		onDelete: 'set null'
	}),
	approvedAt: datetime('approved_at'),
	rejectedBy: varchar('rejected_by', { length: 255 }).references(() => user.id, {
		onDelete: 'set null'
	}),
	rejectedAt: datetime('rejected_at'),
	rejectionReason: varchar('rejection_reason', { length: 255 }),
	approvalOverridden: boolean('approval_overridden').notNull().default(false)
};
