import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { transactions } from '$lib/server/db/schema';

/**
 * Money must come back from the database as a number.
 *
 * CLAUDE.md §9 requires `decimal` with `mode: 'number'`, and the reason is that Drizzle returns a
 * plain string without it — so `row.amount + row.vatAmount` silently concatenates and `500 + 200`
 * becomes `'500200'`. Nothing throws, nothing logs, and the total is simply wrong.
 *
 * `transactions` shipped without the mode and nothing caught it, because every existing use was a
 * SQL-level `SUM()` or comparison where the string never reached JavaScript. The moment a second
 * money column was added beside it and the two were meant to add up, that stopped being safe.
 *
 * This is a guard rather than a unit test: it asserts the column *configuration* survives, which
 * a reviewer cannot see by reading a query. Runs only against a real database.
 */
const hasDb = Boolean(process.env.DATABASE_URL);

describe('money columns', () => {
	it.runIf(hasDb)('come back as numbers, not strings', async () => {
		const sentinel = new Error('rollback');

		try {
			await db.transaction(async (tx) => {
				const [inserted] = await tx
					.insert(transactions)
					.values({ direction: 'in', amount: 1000, subtotal: 869.57, vatAmount: 130.43 })
					.$returningId();

				const [row] = await tx
					.select({
						amount: transactions.amount,
						subtotal: transactions.subtotal,
						vatAmount: transactions.vatAmount
					})
					.from(transactions)
					.where(eq(transactions.id, inserted.id));

				expect(typeof row.amount).toBe('number');
				expect(typeof row.subtotal).toBe('number');
				expect(typeof row.vatAmount).toBe('number');

				// The failure this exists to catch: string concatenation masquerading as addition.
				expect((row.subtotal ?? 0) + (row.vatAmount ?? 0)).toBeCloseTo(row.amount, 2);

				throw sentinel;
			});
		} catch (err) {
			if (err !== sentinel) throw err;
		}
	});
});
