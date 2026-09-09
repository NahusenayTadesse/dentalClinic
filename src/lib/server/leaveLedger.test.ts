import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { employeeLeaveGrant, leave, leaveType } from '$lib/server/db/schema';
import { leaveBalance } from './leaveAccrual';
import {
	ledgerCost,
	readLeaveStates,
	settleLeaveBatch,
	settleLeaveDeletion,
	settleLeaveEdit,
	type LeaveLedgerState
} from './leaveLedger';

const state = (over: Partial<LeaveLedgerState> = {}): LeaveLedgerState => ({
	id: 1,
	staffId: 7,
	status: 'pending',
	days: 5,
	startDate: '2026-03-02',
	endDate: '2026-03-06',
	deductsBalance: true,
	...over
});

describe('ledgerCost', () => {
	it('costs nothing until the leave is approved', () => {
		expect(ledgerCost(state({ status: 'pending' }))).toBe(0);
		expect(ledgerCost(state({ status: 'rejected' }))).toBe(0);
		expect(ledgerCost(state({ status: 'approved' }))).toBe(5);
	});

	it('costs nothing for a type that is granted on top of the balance', () => {
		expect(ledgerCost(state({ status: 'approved', deductsBalance: false }))).toBe(0);
		// An unmatched leave type joins as null, which must not be read as "deducts".
		expect(ledgerCost(state({ status: 'approved', deductsBalance: null }))).toBe(0);
	});

	it('uses the stored duration so half days survive', () => {
		expect(ledgerCost(state({ status: 'approved', days: 4.5 }))).toBe(4.5);
	});

	it('falls back to the calendar span only for rows written before days was stored', () => {
		expect(ledgerCost(state({ status: 'approved', days: 0 }))).toBe(5);
	});
});

describe('transition arithmetic', () => {
	const delta = (before: LeaveLedgerState, nextStatus: 'pending' | 'approved' | 'rejected') =>
		ledgerCost({ ...before, status: nextStatus }) - ledgerCost(before);

	it('spends once when a pending leave is approved', () => {
		expect(delta(state({ status: 'pending' }), 'approved')).toBe(5);
	});

	it('does not charge again when an approved leave is saved unchanged', () => {
		// This is the double-charge that applying the destination status produced.
		expect(delta(state({ status: 'approved' }), 'approved')).toBe(0);
	});

	it('refunds when an approved leave goes back to pending or rejected', () => {
		expect(delta(state({ status: 'approved' }), 'pending')).toBe(-5);
		expect(delta(state({ status: 'approved' }), 'rejected')).toBe(-5);
	});

	it('moves nothing when a rejected leave is rejected again', () => {
		expect(delta(state({ status: 'rejected' }), 'rejected')).toBe(0);
	});

	it('settles a shortened approved leave by the difference', () => {
		const before = state({ status: 'approved', days: 5 });
		const after = ledgerCost({ ...before, days: 3 }) - ledgerCost(before);
		expect(after).toBe(-2);
	});

	it('refunds in full when an approved leave switches to a non-deducting type', () => {
		const before = state({ status: 'approved', deductsBalance: true });
		const after = ledgerCost({ ...before, deductsBalance: false }) - ledgerCost(before);
		expect(after).toBe(-5);
	});
});

/**
 * Runs `body` against a real transaction and always rolls it back, so these cases exercise the
 * live wiring — reads, netting and the accrual calls — without leaving anything behind.
 */
async function inRollback<T>(
	body: (tx: Parameters<Parameters<typeof db.transaction>[0]>[0]) => Promise<T>
) {
	const sentinel = new Error('rollback');
	let result: T | undefined;

	try {
		await db.transaction(async (tx) => {
			result = await body(tx);
			throw sentinel;
		});
	} catch (err) {
		if (err !== sentinel) throw err;
	}

	return result as T;
}

/** An employee with a live grant, and a leave type that actually draws on the balance. */
async function fixture(tx: Parameters<Parameters<typeof db.transaction>[0]>[0]) {
	const [grant] = await tx
		.select({ staffId: employeeLeaveGrant.staffId })
		.from(employeeLeaveGrant)
		.where(eq(employeeLeaveGrant.status, 'active'))
		.limit(1);

	const [type] = await tx
		.select({ id: leaveType.id })
		.from(leaveType)
		.where(eq(leaveType.deductsBalance, true))
		.limit(1);

	return { staffId: grant.staffId, leaveTypeId: type.id };
}

describe('settlement against the database', () => {
	it('spends once, then does not charge again when the same batch is re-submitted', async () => {
		await inRollback(async (tx) => {
			const { staffId, leaveTypeId } = await fixture(tx);
			const opening = await leaveBalance(staffId, tx);

			await tx.insert(leave).values({
				staffId,
				leaveTypeId,
				requestDate: '2026-03-01' as never,
				startDate: '2026-03-02' as never,
				endDate: '2026-03-04' as never,
				days: 3,
				status: 'pending',
				reason: 'ledger test'
			});

			const [row] = await tx
				.select({ id: leave.id })
				.from(leave)
				.where(eq(leave.reason, 'ledger test'));

			// Approving spends the three days.
			let before = await readLeaveStates(tx, [row.id]);
			await tx.update(leave).set({ status: 'approved' }).where(eq(leave.id, row.id));
			await settleLeaveBatch(tx, before, 'approved');
			expect(await leaveBalance(staffId, tx)).toBe(opening - 3);

			// Re-submitting the same approval must move nothing. Before the fix this charged again.
			before = await readLeaveStates(tx, [row.id]);
			await settleLeaveBatch(tx, before, 'approved');
			expect(await leaveBalance(staffId, tx)).toBe(opening - 3);

			// Sending it back to pending returns exactly what was taken.
			before = await readLeaveStates(tx, [row.id]);
			await tx.update(leave).set({ status: 'pending' }).where(eq(leave.id, row.id));
			await settleLeaveBatch(tx, before, 'pending');
			expect(await leaveBalance(staffId, tx)).toBe(opening);
		});
	});

	it('settles a shortened approved leave by the difference', async () => {
		await inRollback(async (tx) => {
			const { staffId, leaveTypeId } = await fixture(tx);
			const opening = await leaveBalance(staffId, tx);

			await tx.insert(leave).values({
				staffId,
				leaveTypeId,
				requestDate: '2026-03-01' as never,
				startDate: '2026-03-02' as never,
				endDate: '2026-03-06' as never,
				days: 5,
				status: 'approved',
				reason: 'ledger shorten'
			});

			const [row] = await tx
				.select({ id: leave.id, leaveTypeId: leave.leaveTypeId })
				.from(leave)
				.where(eq(leave.reason, 'ledger shorten'));

			// Pay for it as approved.
			await settleLeaveBatch(
				tx,
				(await readLeaveStates(tx, [row.id])).map((s) => ({ ...s, status: 'pending' as const })),
				'approved'
			);
			const paid = await leaveBalance(staffId, tx);

			// Now shorten it to 2.5 days while it stays approved: 2.5 days must come back. Before
			// the fix this charged another 2.5 instead.
			const before = await readLeaveStates(tx, [row.id]);
			await tx.update(leave).set({ days: 2.5 }).where(eq(leave.id, row.id));
			await settleLeaveEdit(tx, before[0], {
				status: 'approved',
				leaveTypeId: row.leaveTypeId,
				days: 2.5
			});

			expect(await leaveBalance(staffId, tx)).toBe(paid + 2.5);
			void opening;
		});
	});
});

describe('deleting an approved leave', () => {
	it('returns the days it had taken off the balance', async () => {
		await inRollback(async (tx) => {
			const { staffId, leaveTypeId } = await fixture(tx);
			const opening = await leaveBalance(staffId, tx);

			await tx.insert(leave).values({
				staffId,
				leaveTypeId,
				requestDate: '2026-03-01' as never,
				startDate: '2026-03-02' as never,
				endDate: '2026-03-04' as never,
				days: 3,
				status: 'pending',
				reason: 'ledger delete'
			});

			const [row] = await tx
				.select({ id: leave.id })
				.from(leave)
				.where(eq(leave.reason, 'ledger delete'));

			// Approve it, so it is actually costing days.
			const before = await readLeaveStates(tx, [row.id]);
			await tx.update(leave).set({ status: 'approved' }).where(eq(leave.id, row.id));
			await settleLeaveBatch(tx, before, 'approved');
			expect(await leaveBalance(staffId, tx)).toBe(opening - 3);

			// Deleting it gives them back. Before the fix the days stayed spent forever.
			const [live] = await readLeaveStates(tx, [row.id]);
			await settleLeaveDeletion(tx, live);
			expect(await leaveBalance(staffId, tx)).toBe(opening);
		});
	});

	it('moves nothing when the deleted leave was never approved', async () => {
		await inRollback(async (tx) => {
			const { staffId, leaveTypeId } = await fixture(tx);
			const opening = await leaveBalance(staffId, tx);

			await tx.insert(leave).values({
				staffId,
				leaveTypeId,
				requestDate: '2026-03-01' as never,
				startDate: '2026-03-02' as never,
				endDate: '2026-03-04' as never,
				days: 3,
				status: 'pending',
				reason: 'ledger delete pending'
			});

			const [live] = await readLeaveStates(
				tx,
				(
					await tx
						.select({ id: leave.id })
						.from(leave)
						.where(eq(leave.reason, 'ledger delete pending'))
				).map((r) => r.id)
			);

			await settleLeaveDeletion(tx, live);
			expect(await leaveBalance(staffId, tx)).toBe(opening);
		});
	});
});
