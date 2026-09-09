import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { leaveType } from '$lib/server/db/schema';
import { leaveAllowanceError } from './leaveAllowance';

/** Runs `body` in a transaction that is always rolled back. */
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

describe('leaveAllowanceError', () => {
	it('passes a request inside the allowance and rejects one past it', async () => {
		await inRollback(async (tx) => {
			const [type] = await tx
				.select({ id: leaveType.id, maxDays: leaveType.maxDays })
				.from(leaveType)
				.where(eq(leaveType.name, 'Marriage Leave'));

			expect(type.maxDays).toBe(5);

			expect(await leaveAllowanceError(tx, type.id, 5)).toBeNull();
			expect(await leaveAllowanceError(tx, type.id, 4.5)).toBeNull();

			const tooLong = await leaveAllowanceError(tx, type.id, 6);
			expect(tooLong).toContain('Marriage Leave');
			expect(tooLong).toContain('5 days');
			expect(tooLong).toContain('6 days');
		});
	});

	it('reports half days in the message rather than rounding them away', async () => {
		await inRollback(async (tx) => {
			const [type] = await tx
				.select({ id: leaveType.id })
				.from(leaveType)
				.where(eq(leaveType.name, 'Marriage Leave'));

			expect(await leaveAllowanceError(tx, type.id, 5.5)).toContain('5.5 days');
		});
	});

	it('treats a zero allowance as unconfigured rather than as no days at all', async () => {
		await inRollback(async (tx) => {
			const [type] = await tx
				.select({ id: leaveType.id })
				.from(leaveType)
				.where(eq(leaveType.name, 'Marriage Leave'));

			await tx.update(leaveType).set({ maxDays: 0 }).where(eq(leaveType.id, type.id));

			// Every type starts at 0, so enforcing it literally would block the type outright.
			expect(await leaveAllowanceError(tx, type.id, 90)).toBeNull();
		});
	});

	it('does not constrain a leave with no type attached', async () => {
		expect(await leaveAllowanceError(db, null, 500)).toBeNull();
		expect(await leaveAllowanceError(db, undefined, 500)).toBeNull();
	});
});
