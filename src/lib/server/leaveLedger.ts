// Keeping the accrued-balance ledger in step with leave requests.
//
// A leave costs the balance only while it is approved and its type draws on the balance. That
// makes the ledger a function of the leave's *state*, not of the action performed on it — so
// every change is settled as the difference between what the leave cost before and what it
// costs after.
//
// Applying the new status alone (the shape this code had previously) double-charges whenever an
// already-approved leave is saved again, and silently leaks days whenever an approved leave's
// dates, duration or type change without its status changing.
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { leave, leaveType } from '$lib/server/db/schema';
import { notDeleted } from '$lib/server/softDelete';
import { consumeLeaveDays, refundLeaveDays } from '$lib/server/leaveAccrual';
import { calendarDays } from '$lib/leaveDays';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Db = typeof db | Tx;

export type LeaveStatus = 'pending' | 'approved' | 'rejected';

/** Everything about a leave that determines what it costs the balance. */
export type LeaveLedgerState = {
	id: number;
	staffId: number;
	status: LeaveStatus | null;
	days: number;
	startDate: Date | string;
	endDate: Date | string;
	deductsBalance: boolean | null;
};

/**
 * Days this leave takes off the accrued balance in the given state — zero unless it is both
 * approved and of a type that draws on the balance.
 *
 * The calendar span is only a fallback for rows written before the duration was stored; `days`
 * is authoritative because it is the only figure that carries half days.
 */
export function ledgerCost(state: {
	status: LeaveStatus | null;
	days: number;
	startDate: Date | string;
	endDate: Date | string;
	deductsBalance: boolean | null;
}): number {
	if (state.status !== 'approved' || !state.deductsBalance) return 0;

	return state.days > 0 ? state.days : calendarDays(state.startDate, state.endDate);
}

/** Reads the ledger-relevant state of the given leaves. Call this *before* updating them. */
export async function readLeaveStates(database: Db, ids: number[]): Promise<LeaveLedgerState[]> {
	if (ids.length === 0) return [];

	return (
		database
			.select({
				id: leave.id,
				staffId: leave.staffId,
				status: leave.status,
				days: leave.days,
				startDate: leave.startDate,
				endDate: leave.endDate,
				deductsBalance: leaveType.deductsBalance
			})
			.from(leave)
			// Deliberately not filtering soft-deleted types: whether a leave draws on the balance is a
			// property of the leave as approved, and retiring the type later must not silently
			// reclassify days that have already been spent.
			.leftJoin(leaveType, eq(leave.leaveTypeId, leaveType.id))
			.where(and(inArray(leave.id, ids), notDeleted(leave)))
	);
}

/**
 * Moves an employee's balance by the difference between two costs. A positive difference spends,
 * a negative one refunds, and no difference touches nothing — which is what makes saving an
 * unchanged leave a no-op rather than a second charge.
 *
 * Returns days that could not be covered by any live grant.
 */
export async function settleLeaveCost(
	database: Db,
	staffId: number,
	previousCost: number,
	nextCost: number
): Promise<number> {
	const delta = nextCost - previousCost;
	if (delta === 0) return 0;

	if (delta > 0) {
		const { shortfall } = await consumeLeaveDays(staffId, delta, database);
		return shortfall;
	}

	await refundLeaveDays(staffId, -delta, database);
	return 0;
}

/**
 * Settles a batch of leaves being moved to `nextStatus`. `before` must be the states read
 * before the update landed.
 *
 * Deltas are netted per employee, so one person appearing several times in a batch moves their
 * balance once. Returns the total days approved beyond what was accrued.
 */
export async function settleLeaveBatch(
	database: Db,
	before: LeaveLedgerState[],
	nextStatus: LeaveStatus
): Promise<number> {
	const deltas = new Map<number, { previous: number; next: number }>();

	for (const state of before) {
		const entry = deltas.get(state.staffId) ?? { previous: 0, next: 0 };

		entry.previous += ledgerCost(state);
		entry.next += ledgerCost({ ...state, status: nextStatus });

		deltas.set(state.staffId, entry);
	}

	let overBooked = 0;

	for (const [staffId, { previous, next }] of deltas) {
		overBooked += await settleLeaveCost(database, staffId, previous, next);
	}

	return overBooked;
}

/**
 * Settles one edited leave. Unlike the batch case the type, dates and duration may all have
 * moved as well as the status, so the new cost is built from the submitted values — including
 * the submitted type's own `deductsBalance`, which decides whether the leave draws on the
 * balance at all.
 */
export async function settleLeaveEdit(
	database: Db,
	before: LeaveLedgerState,
	next: { status: LeaveStatus; leaveTypeId: number | null; days: number }
): Promise<number> {
	let deductsBalance: boolean | null = before.deductsBalance;

	if (next.leaveTypeId !== null && next.leaveTypeId !== undefined) {
		const [type] = await database
			.select({ deductsBalance: leaveType.deductsBalance })
			.from(leaveType)
			.where(eq(leaveType.id, next.leaveTypeId));

		deductsBalance = type?.deductsBalance ?? false;
	}

	return settleLeaveCost(
		database,
		before.staffId,
		ledgerCost(before),
		ledgerCost({
			status: next.status,
			days: next.days,
			startDate: before.startDate,
			endDate: before.endDate,
			deductsBalance
		})
	);
}

/**
 * A deleted leave costs nothing, so whatever it had taken off the balance comes back.
 *
 * Call with the state read *before* the row is stamped deleted — once `deletedAt` is set,
 * `readLeaveStates` will not find it.
 */
export async function settleLeaveDeletion(database: Db, before: LeaveLedgerState): Promise<void> {
	await settleLeaveCost(database, before.staffId, ledgerCost(before), 0);
}
