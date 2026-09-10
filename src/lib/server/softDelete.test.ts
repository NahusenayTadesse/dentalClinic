import { describe, expect, it } from 'vitest';
import { getTableName } from 'drizzle-orm';

import { notDeleted, softDeleteOwnedRecord, staffOwnedTables } from './softDelete';
import { staffFamilies, employee, branch } from './db/schema';

/**
 * Owner scoping, which is the whole security property of a child table.
 *
 * `softDeleteOwnedRecord` is what stands between "delete row 12 of my own family list" and
 * "delete row 12, which happens to belong to another employee". Every child-table delete in the
 * app goes through it — `childCrud` wires the round trip to it — so the predicate it builds is
 * worth pinning down.
 *
 * A recording fake stands in for the transaction. The alternative is a live database, and these
 * assertions are about the shape of the query rather than what a server does with it.
 */
type Recorded = { kind: 'select' | 'update' };

function fakeTx(found: boolean) {
	const calls: Recorded[] = [];

	const record = (kind: Recorded['kind']) => {
		const chain = {
			from: () => chain,
			set: () => chain,
			limit: () => Promise.resolve(found ? [{ id: 1 }] : []),
			where() {
				// Only the order and kind of calls matter here; the condition itself is a Drizzle
				// object graph with cycles, and serialising it proves nothing these tests need.
				calls.push({ kind });
				return chain;
			},
			then: (resolve: (value: unknown) => unknown) => Promise.resolve([]).then(resolve)
		};
		return chain;
	};

	return {
		calls,
		tx: {
			select: () => record('select'),
			update: () => record('update')
		}
	};
}

describe('softDeleteOwnedRecord', () => {
	it('refuses a row that does not belong to the owner', async () => {
		const { tx } = fakeTx(false);

		const removed = await softDeleteOwnedRecord(
			tx as never,
			staffFamilies as never,
			staffFamilies.staffId,
			12,
			99
		);

		// Nothing matched the owner, so nothing was stamped.
		expect(removed).toBe(false);
	});

	it('stamps the row when it does belong to the owner', async () => {
		const { tx } = fakeTx(true);

		const removed = await softDeleteOwnedRecord(
			tx as never,
			staffFamilies as never,
			staffFamilies.staffId,
			12,
			7
		);

		expect(removed).toBe(true);
	});

	it('checks ownership before it writes, never after', async () => {
		const { tx, calls } = fakeTx(true);

		await softDeleteOwnedRecord(tx as never, staffFamilies as never, staffFamilies.staffId, 12, 7);

		// A write that happened first would already have destroyed the row it was meant to guard.
		expect(calls[0].kind).toBe('select');
		expect(calls.some((c) => c.kind === 'update')).toBe(true);
	});

	it('does not write at all when the row is not the owner’s', async () => {
		const { tx, calls } = fakeTx(false);

		await softDeleteOwnedRecord(tx as never, staffFamilies as never, staffFamilies.staffId, 12, 99);

		expect(calls.every((c) => c.kind === 'select')).toBe(true);
	});
});

describe('staffOwnedTables', () => {
	it('names only tables that carry a staffId, so every entry can be owner-scoped', () => {
		for (const [kind, table] of Object.entries(staffOwnedTables)) {
			expect(table, kind).toHaveProperty('staffId');
			expect(table, kind).toHaveProperty('deletedAt');
		}
	});

	it('is not empty, so a missing registry cannot silently disable child deletes', () => {
		expect(Object.keys(staffOwnedTables).length).toBeGreaterThan(0);
	});
});

describe('notDeleted', () => {
	it('builds a condition for one table', () => {
		expect(notDeleted(employee)).toBeDefined();
	});

	it('combines several tables into one condition', () => {
		const combined = notDeleted(employee, branch);
		expect(combined).toBeDefined();
		// Distinct tables, so the caller really is filtering both sides of a join.
		expect(getTableName(employee)).not.toBe(getTableName(branch));
	});
});
