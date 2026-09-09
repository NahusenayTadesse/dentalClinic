// supplyLeases.ts - Leasing company-owned supplies out to sites.
//
// The company always owns the stock. A lease moves items from the store to a
// site; it never transfers ownership. That gives three quantities per supply:
//
//   on hand     = `supplies.quantity`, maintained by `supplies_adjustments`
//   reserved    = approved but not yet handed over
//   leased out  = issued and not yet returned (returnable items only)
//   total owned = on hand + leased out
//
// Reserved and leased-out are *derived* by summing the rows below rather than
// stored as counters, so they cannot drift away from the history that explains
// them. See `supplies.quantity` in `inventory.ts`, which is a running total and
// is the one number a lease must keep correct.
//
// Every actor is a `user`, not an `employee` — approval rights come from the
// permission system, which is user-scoped.

import {
	mysqlTable,
	varchar,
	int,
	decimal,
	date,
	datetime,
	boolean,
	mysqlEnum,
	index,
	uniqueIndex
} from 'drizzle-orm/mysql-core';
import { secureFields } from './secureFields';
import { supplies, suppliesAdjustments, damagedSupplies } from './inventory';
import { site } from './sites';
import { user } from './user';

/**
 * The lease lifecycle. `pending` is a request; approval and physical hand-over
 * are separate steps so that approved-but-not-collected stock is visible as
 * reserved rather than silently counted as still in the store.
 *
 *   pending -> approved -> issued -> partially_returned -> returned -> closed
 *      |           |
 *      v           v
 *   rejected    cancelled
 *
 * Non-returnable (consumed) lines never reach `returned`; their lease is
 * `closed` once everything has been issued.
 */
export const leaseStatuses = [
	'pending',
	'approved',
	'rejected',
	'cancelled',
	'issued',
	'partially_returned',
	'returned',
	'closed'
] as const;

export const supplyLeases = mysqlTable(
	'supply_leases',
	{
		id: int('id').primaryKey().autoincrement(),
		// Human-facing reference printed on the gate pass. Nullable so a draft can
		// exist before the number is assigned; unique once it is.
		referenceNumber: varchar('reference_number', { length: 50 }),
		siteId: int('site_id')
			.notNull()
			.references(() => site.id),
		status: mysqlEnum('status', leaseStatuses).notNull().default('pending'),
		// Why the site needs these supplies - required on every request.
		reason: varchar('reason', { length: 255 }).notNull(),
		// When the returnable lines are due back. Null for a purely consumable lease.
		expectedReturnDate: date('expected_return_date'),
		// Signed request / gate pass / hand-over sheet.
		documentFile: varchar('document_file', { length: 255 }),

		// --- audit trail: who did what, when, and why ---------------------------
		requestedBy: varchar('requested_by', { length: 255 })
			.notNull()
			.references(() => user.id),
		requestedAt: datetime('requested_at').notNull(),

		approvedBy: varchar('approved_by', { length: 255 }).references(() => user.id, {
			onDelete: 'set null'
		}),
		approvedAt: datetime('approved_at'),
		approvalNote: varchar('approval_note', { length: 255 }),

		rejectedBy: varchar('rejected_by', { length: 255 }).references(() => user.id, {
			onDelete: 'set null'
		}),
		rejectedAt: datetime('rejected_at'),
		rejectedReason: varchar('rejected_reason', { length: 255 }),

		cancelledBy: varchar('cancelled_by', { length: 255 }).references(() => user.id, {
			onDelete: 'set null'
		}),
		cancelledAt: datetime('cancelled_at'),
		cancellationReason: varchar('cancellation_reason', { length: 255 }),

		issuedBy: varchar('issued_by', { length: 255 }).references(() => user.id, {
			onDelete: 'set null'
		}),
		issuedAt: datetime('issued_at'),
		// Whoever signed for the goods at the site. Free text on purpose: the
		// receiver is a person on the customer's premises, not a system user.
		receivedByName: varchar('received_by_name', { length: 100 }),
		receivedByPhone: varchar('received_by_phone', { length: 20 }),

		closedBy: varchar('closed_by', { length: 255 }).references(() => user.id, {
			onDelete: 'set null'
		}),
		closedAt: datetime('closed_at'),

		...secureFields
	},
	(table) => [
		uniqueIndex('unique_lease_reference').on(table.referenceNumber),
		index('lease_site_idx').on(table.siteId),
		index('lease_status_idx').on(table.status),
		index('lease_requested_by_idx').on(table.requestedBy)
	]
);

/**
 * One line per supply on a lease. The three quantities are what the derived
 * stock figures are summed from:
 *
 *   reserved   = SUM(quantity_approved - quantity_issued)  where lease is approved
 *   leased out = SUM(quantity_issued - quantity_returned)  where returnable
 *
 * `quantity_issued` and `quantity_returned` are maintained from the movement
 * rows below, which are the authoritative record of each physical hand-over.
 */
export const supplyLeaseItems = mysqlTable(
	'supply_lease_items',
	{
		id: int('id').primaryKey().autoincrement(),
		leaseId: int('lease_id')
			.notNull()
			.references(() => supplyLeases.id, { onDelete: 'cascade' }),
		supplyId: int('supply_id')
			.notNull()
			.references(() => supplies.id),
		quantityRequested: int('quantity_requested').notNull(),
		// Approvers may grant less than was asked for.
		quantityApproved: int('quantity_approved').notNull().default(0),
		quantityIssued: int('quantity_issued').notNull().default(0),
		quantityReturned: int('quantity_returned').notNull().default(0),
		// Quantity that will never come back - consumed, lost or written off at the
		// site. Kept apart from `quantity_returned` so a line can be closed out
		// without pretending the goods came back.
		quantityWrittenOff: int('quantity_written_off').notNull().default(0),
		// Snapshot of `supplies.returnable` at lease time. Flipping the flag on the
		// supply later must not retroactively change what an open lease owes.
		returnable: boolean('returnable').notNull().default(false),
		// Valuation of what is out at the site, for the stock report.
		unitCost: decimal('unit_cost', { precision: 10, scale: 2 }),
		notes: varchar('notes', { length: 255 }),
		...secureFields
	},
	(table) => [
		uniqueIndex('unique_supply_per_lease').on(table.leaseId, table.supplyId),
		index('lease_item_supply_idx').on(table.supplyId)
	]
);

export const leaseMovementTypes = ['issue', 'return', 'write_off'] as const;

/**
 * Every physical hand-over: stock leaving the store for a site, coming back, or
 * being written off there. Each movement links to the `supplies_adjustments`
 * row it caused, so the running stock total always has a lease to point at.
 *
 * The FK lives on this side rather than as a `lease_item_id` on
 * `supplies_adjustments` to keep `inventory.ts` free of an import back into this
 * module - and because one lease line legitimately produces several movements
 * (one issue, then several partial returns).
 */
export const supplyLeaseMovements = mysqlTable(
	'supply_lease_movements',
	{
		id: int('id').primaryKey().autoincrement(),
		leaseItemId: int('lease_item_id')
			.notNull()
			.references(() => supplyLeaseItems.id, { onDelete: 'cascade' }),
		movementType: mysqlEnum('movement_type', leaseMovementTypes).notNull(),
		// Always positive; `movement_type` carries the direction.
		quantity: int('quantity').notNull(),
		// What came back, for returns. `damaged` and `lost` do not restore usable
		// stock, so they write off instead of returning.
		condition: mysqlEnum('condition', ['good', 'damaged', 'lost']),
		// The stock movement this caused: negative on issue, positive on a good
		// return, absent when the goods never re-entered the store.
		adjustmentId: int('adjustment_id').references(() => suppliesAdjustments.id, {
			onDelete: 'set null'
		}),
		// Set when a return came back broken, linking to the damage report.
		// Named `damage_report_id` rather than `damaged_supplies_id` only because
		// the latter pushes drizzle's generated FK name past MySQL's 64-char limit.
		damageReportId: int('damage_report_id').references(() => damagedSupplies.id, {
			onDelete: 'set null'
		}),
		reason: varchar('reason', { length: 255 }),
		performedBy: varchar('performed_by', { length: 255 })
			.notNull()
			.references(() => user.id),
		performedAt: datetime('performed_at').notNull(),
		...secureFields
	},
	(table) => [
		index('lease_movement_item_idx').on(table.leaseItemId),
		index('lease_movement_type_idx').on(table.movementType)
	]
);

/**
 * Append-only log of every status change on a lease. The actor columns on
 * `supply_leases` answer "who approved this"; this table answers "what happened
 * to it, in order" - including a re-approval that would otherwise overwrite the
 * previous approver.
 *
 * Nothing writes to a row here after it is inserted.
 */
export const supplyLeaseEvents = mysqlTable(
	'supply_lease_events',
	{
		id: int('id').primaryKey().autoincrement(),
		leaseId: int('lease_id')
			.notNull()
			.references(() => supplyLeases.id, { onDelete: 'cascade' }),
		// Null on the row that records the lease being created.
		fromStatus: mysqlEnum('from_status', leaseStatuses),
		toStatus: mysqlEnum('to_status', leaseStatuses).notNull(),
		actedBy: varchar('acted_by', { length: 255 })
			.notNull()
			.references(() => user.id),
		actedAt: datetime('acted_at').notNull(),
		note: varchar('note', { length: 500 }),
		...secureFields
	},
	(table) => [index('lease_event_lease_idx').on(table.leaseId, table.actedAt)]
);
