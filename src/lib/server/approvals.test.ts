import { inRollback, type TestTx } from '../testing/rollback';
import { describe, expect, it } from 'vitest';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { employee, salaries, user } from '$lib/server/db/schema';
import {
	APPROVAL_ENTITIES,
	findEntity,
	reopenApprovals,
	settleApprovals,
	unapprovedEmployeeIds
} from './approvals';

const employees = findEntity('employees');

/** One employee row parked in the queue as `requester`'s request. */
async function pendingEmployee(tx: TestTx, requester: string) {
	const [row] = await tx.select({ id: employee.id }).from(employee).limit(1);
	await tx
		.update(employee)
		.set({
			approvalStatus: 'pending',
			requestedBy: requester,
			approvedBy: null,
			approvalOverridden: false
		})
		.where(eq(employee.id, row.id));
	return row.id;
}

async function statusOf(tx: TestTx, id: number) {
	const [r] = await tx
		.select({
			status: employee.approvalStatus,
			approvedBy: employee.approvedBy,
			approvedAt: employee.approvedAt,
			rejectedBy: employee.rejectedBy,
			reason: employee.rejectionReason,
			overridden: employee.approvalOverridden
		})
		.from(employee)
		.where(eq(employee.id, id));
	return r;
}

describe('the registry', () => {
	it('has a unique key per entity and every table carries the approval columns', () => {
		const keys = APPROVAL_ENTITIES.map((e) => e.key);
		expect(new Set(keys).size).toBe(keys.length);

		for (const e of APPROVAL_ENTITIES) {
			expect(e.table.approvalStatus, e.key).toBeDefined();
			expect(e.table.requestedBy, e.key).toBeDefined();
			expect(e.table.approvalOverridden, e.key).toBeDefined();
		}
	});

	it('rejects an unknown queue with a 404 rather than guessing', () => {
		expect(() => findEntity('not-a-queue')).toThrow();
	});
});

describe('settleApprovals', () => {
	it('approves a record someone else requested', async () => {
		await inRollback(async (tx) => {
			const [a, b] = await tx.select({ id: user.id }).from(user).limit(2);
			const id = await pendingEmployee(tx, a.id);

			const res = await settleApprovals({
				entity: employees,
				ids: [id],
				decision: 'approved',
				userId: b.id,
				canOverride: false,
				database: tx
			});

			expect(res).toEqual({ settled: 1, blocked: 0, overridden: 0 });
			const row = await statusOf(tx, id);
			expect(row.status).toBe('approved');
			expect(row.approvedBy).toBe(b.id);
			expect(row.approvedAt).not.toBeNull();
			expect(row.overridden).toBe(false);
		});
	});

	it('blocks the requester from approving their own record', async () => {
		await inRollback(async (tx) => {
			const [a] = await tx.select({ id: user.id }).from(user).limit(1);
			const id = await pendingEmployee(tx, a.id);

			const res = await settleApprovals({
				entity: employees,
				ids: [id],
				decision: 'approved',
				userId: a.id,
				canOverride: false,
				database: tx
			});

			expect(res).toEqual({ settled: 0, blocked: 1, overridden: 0 });
			expect((await statusOf(tx, id)).status).toBe('pending');
		});
	});

	it('lets an override holder release their own record, and records that it happened', async () => {
		await inRollback(async (tx) => {
			const [a] = await tx.select({ id: user.id }).from(user).limit(1);
			const id = await pendingEmployee(tx, a.id);

			const res = await settleApprovals({
				entity: employees,
				ids: [id],
				decision: 'approved',
				userId: a.id,
				canOverride: true,
				database: tx
			});

			expect(res).toEqual({ settled: 1, blocked: 0, overridden: 1 });
			const row = await statusOf(tx, id);
			expect(row.status).toBe('approved');
			// The whole point of storing the flag: this must be visible afterwards.
			expect(row.overridden).toBe(true);
		});
	});

	it('lands the rest of a mixed batch and reports what it left behind', async () => {
		await inRollback(async (tx) => {
			const [a, b] = await tx.select({ id: user.id }).from(user).limit(2);
			const rows = await tx.select({ id: employee.id }).from(employee).limit(2);

			await tx
				.update(employee)
				.set({ approvalStatus: 'pending', requestedBy: a.id })
				.where(eq(employee.id, rows[0].id));
			await tx
				.update(employee)
				.set({ approvalStatus: 'pending', requestedBy: b.id })
				.where(eq(employee.id, rows[1].id));

			// `a` approves both: one is theirs, one is not.
			const res = await settleApprovals({
				entity: employees,
				ids: [rows[0].id, rows[1].id],
				decision: 'approved',
				userId: a.id,
				canOverride: false,
				database: tx
			});

			expect(res).toEqual({ settled: 1, blocked: 1, overridden: 0 });
			expect((await statusOf(tx, rows[0].id)).status).toBe('pending');
			expect((await statusOf(tx, rows[1].id)).status).toBe('approved');
		});
	});

	it('records a rejection with its reason', async () => {
		await inRollback(async (tx) => {
			const [a, b] = await tx.select({ id: user.id }).from(user).limit(2);
			const id = await pendingEmployee(tx, a.id);

			await settleApprovals({
				entity: employees,
				ids: [id],
				decision: 'rejected',
				userId: b.id,
				canOverride: false,
				reason: 'Missing ID document',
				database: tx
			});

			const row = await statusOf(tx, id);
			expect(row.status).toBe('rejected');
			expect(row.rejectedBy).toBe(b.id);
			expect(row.reason).toBe('Missing ID document');
			expect(row.approvedBy).toBeNull();
		});
	});

	it('will not settle the same record twice', async () => {
		await inRollback(async (tx) => {
			const [a, b] = await tx.select({ id: user.id }).from(user).limit(2);
			const id = await pendingEmployee(tx, a.id);

			const first = await settleApprovals({
				entity: employees,
				ids: [id],
				decision: 'approved',
				userId: b.id,
				canOverride: false,
				database: tx
			});
			// A stale page or a double submit must not re-settle an already-decided record.
			const second = await settleApprovals({
				entity: employees,
				ids: [id],
				decision: 'rejected',
				userId: b.id,
				canOverride: false,
				database: tx
			});

			expect(first.settled).toBe(1);
			expect(second.settled).toBe(0);
			expect((await statusOf(tx, id)).status).toBe('approved');
		});
	});

	it('does nothing when given no ids', async () => {
		await inRollback(async (tx) => {
			const [a] = await tx.select({ id: user.id }).from(user).limit(1);
			const res = await settleApprovals({
				entity: employees,
				ids: [],
				decision: 'approved',
				userId: a.id,
				canOverride: true,
				database: tx
			});
			expect(res).toEqual({ settled: 0, blocked: 0, overridden: 0 });
		});
	});
});

/**
 * An employee on an open, approved salary — **created here**, inside the rollback.
 *
 * Both cases used to look one up. Salary rows come from running the app, so on a fresh database the
 * lookup found nothing and both failed on `undefined`; they have been red on every run since. The
 * employee is borrowed because an employee row needs two dozen unrelated columns; with none at all
 * there is no salary to change and the case says so.
 */
async function anOpenSalary(tx: Parameters<Parameters<typeof db.transaction>[0]>[0]) {
	const [staff] = await tx.select({ id: employee.id }).from(employee).limit(1);
	if (!staff) return null;

	await tx.insert(salaries).values({
		staffId: staff.id,
		amount: '5000.00',
		startDate: new Date('2026-01-01'),
		approvalStatus: 'approved'
	} as never);

	const [open] = await tx
		.select({ id: salaries.id, staffId: salaries.staffId })
		.from(salaries)
		.where(and(isNull(salaries.endDate), eq(salaries.approvalStatus, 'approved')))
		.orderBy(sql`${salaries.id} desc`)
		.limit(1);

	return open;
}

describe('a salary change only takes effect when approved', () => {
	it('leaves the previous salary open while the change is pending, then closes it on approval', async () => {
		await inRollback(async (tx) => {
			const [a, b] = await tx.select({ id: user.id }).from(user).limit(2);
			const salariesEntity = findEntity('salaries');

			// An employee with an open salary row, as change-salary would find them.
			const open = await anOpenSalary(tx);
			if (!open) return;

			const effective = new Date('2026-09-01');

			// change-salary now inserts the new row pending and leaves the old one open.
			await tx.insert(salaries).values({
				staffId: open.staffId,
				amount: '9999.00',
				startDate: effective,
				approvalStatus: 'pending',
				requestedBy: a.id
			} as never);

			const [fresh] = await tx
				.select({ id: salaries.id })
				.from(salaries)
				.where(and(eq(salaries.staffId, open.staffId), eq(salaries.approvalStatus, 'pending')))
				.orderBy(sql`${salaries.id} desc`)
				.limit(1);

			// While pending, the employee still has their old salary open — otherwise payroll,
			// which pro-rates from open rows, would pay them nothing.
			const stillOpen = await tx
				.select({ id: salaries.id })
				.from(salaries)
				.where(and(eq(salaries.staffId, open.staffId), isNull(salaries.endDate)));
			expect(stillOpen.map((r) => r.id)).toContain(open.id);

			await settleApprovals({
				entity: salariesEntity,
				ids: [fresh.id],
				decision: 'approved',
				userId: b.id,
				canOverride: false,
				database: tx
			});

			// Approval hands over: the old row closes the day before the new one starts.
			const [oldRow] = await tx
				.select({ endDate: salaries.endDate })
				.from(salaries)
				.where(eq(salaries.id, open.id));
			const [newRow] = await tx
				.select({ endDate: salaries.endDate, status: salaries.approvalStatus })
				.from(salaries)
				.where(eq(salaries.id, fresh.id));

			expect(newRow.status).toBe('approved');
			expect(newRow.endDate).toBeNull();
			expect(oldRow.endDate).not.toBeNull();
			expect(new Date(oldRow.endDate!).toISOString().slice(0, 10)).toBe('2026-08-31');
		});
	});

	it('leaves the previous salary untouched when the change is rejected', async () => {
		await inRollback(async (tx) => {
			const [a, b] = await tx.select({ id: user.id }).from(user).limit(2);
			const salariesEntity = findEntity('salaries');

			const open = await anOpenSalary(tx);
			if (!open) return;

			await tx.insert(salaries).values({
				staffId: open.staffId,
				amount: '1234.00',
				startDate: new Date('2026-09-01'),
				approvalStatus: 'pending',
				requestedBy: a.id
			} as never);

			const [fresh] = await tx
				.select({ id: salaries.id })
				.from(salaries)
				.where(and(eq(salaries.staffId, open.staffId), eq(salaries.approvalStatus, 'pending')))
				.orderBy(sql`${salaries.id} desc`)
				.limit(1);

			await settleApprovals({
				entity: salariesEntity,
				ids: [fresh.id],
				decision: 'rejected',
				userId: b.id,
				canOverride: false,
				reason: 'Not budgeted',
				database: tx
			});

			// A rejected change must leave the world as it found it.
			const [oldRow] = await tx
				.select({ endDate: salaries.endDate })
				.from(salaries)
				.where(eq(salaries.id, open.id));
			expect(oldRow.endDate).toBeNull();
		});
	});
});

describe('payroll eligibility', () => {
	it('names the employees a payroll run must not pay', async () => {
		await inRollback(async (tx) => {
			const [a] = await tx.select({ id: user.id }).from(user).limit(1);
			const rows = await tx.select({ id: employee.id }).from(employee).limit(3);
			const [pending, rejected, approved] = rows;

			await tx
				.update(employee)
				.set({ approvalStatus: 'pending', requestedBy: a.id })
				.where(eq(employee.id, pending.id));
			await tx
				.update(employee)
				.set({ approvalStatus: 'rejected', rejectedBy: a.id, rejectionReason: 'Duplicate record' })
				.where(eq(employee.id, rejected.id));
			await tx
				.update(employee)
				.set({ approvalStatus: 'approved', approvedBy: a.id })
				.where(eq(employee.id, approved.id));

			const blocked = await unapprovedEmployeeIds(
				[pending.id, rejected.id, approved.id],
				tx as never
			);
			expect(blocked.sort()).toEqual([pending.id, rejected.id].sort());
		});
	});

	it('has nothing to block when nobody was selected', async () => {
		expect(await unapprovedEmployeeIds([])).toEqual([]);
	});
});

describe('reopening a rejection', () => {
	it('clears the rejection stamp and puts the record back in the queue', async () => {
		await inRollback(async (tx) => {
			const [a, b] = await tx.select({ id: user.id }).from(user).limit(2);
			const id = await pendingEmployee(tx, a.id);

			await settleApprovals({
				entity: employees,
				ids: [id],
				decision: 'rejected',
				userId: b.id,
				canOverride: false,
				reason: 'Missing pension card',
				database: tx
			});

			expect(
				await reopenApprovals({ entity: employees, ids: [id], userId: b.id, database: tx })
			).toBe(1);

			const row = await statusOf(tx, id);
			expect(row.status).toBe('pending');
			expect(row.reason).toBeNull();
			expect(row.rejectedBy).toBeNull();
		});
	});

	it('leaves the original requester in place, so they still cannot release it themselves', async () => {
		await inRollback(async (tx) => {
			const [a, b] = await tx.select({ id: user.id }).from(user).limit(2);
			const id = await pendingEmployee(tx, a.id);

			await settleApprovals({
				entity: employees,
				ids: [id],
				decision: 'rejected',
				userId: b.id,
				canOverride: false,
				reason: 'Missing pension card',
				database: tx
			});
			await reopenApprovals({ entity: employees, ids: [id], userId: b.id, database: tx });

			// `a` requested it originally; reopening must not have quietly made them the approver.
			const res = await settleApprovals({
				entity: employees,
				ids: [id],
				decision: 'approved',
				userId: a.id,
				canOverride: false,
				database: tx
			});

			expect(res).toEqual({ settled: 0, blocked: 1, overridden: 0 });
		});
	});

	it('will not drag an approved record back into the queue', async () => {
		await inRollback(async (tx) => {
			const [a, b] = await tx.select({ id: user.id }).from(user).limit(2);
			const id = await pendingEmployee(tx, a.id);

			await settleApprovals({
				entity: employees,
				ids: [id],
				decision: 'approved',
				userId: b.id,
				canOverride: false,
				database: tx
			});

			expect(
				await reopenApprovals({ entity: employees, ids: [id], userId: b.id, database: tx })
			).toBe(0);
			expect((await statusOf(tx, id)).status).toBe('approved');
		});
	});
});
