import { describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';

import { db } from './db';
import { auditLog, branch, paymentMethods, transactions } from './db/schema';
import { inRollback } from '$lib/testing/rollback';
import { insertReturningId } from '@nahu/admin-kit/server/db/insert.js';
import { WriteRefused } from './childCrud';
import { setReconciled, transferTotals, transfersOn } from './mobileMoney';

const refusals = { notHere: 'not here' };

/**
 * A day's transfers, ticked against the statement. Payments are written straight into a rollback
 * on a day long after anything a clinic has entered; only a branch is borrowed.
 */
describe('mobile money', async () => {
	const [here] = await db.select({ id: branch.id }).from(branch).limit(1);
	const day = '2033-01-10';
	const event = {
		locals: { user: null, branch: { active: here?.id ?? null } },
		getClientAddress: () => '127.0.0.1'
	};

	it.skipIf(!here)(
		'lists a day’s transfers, ticks and unticks them, and leaves cash alone',
		async () => {
			const result = await inRollback(async (tx) => {
				const mobile = await insertReturningId(tx, paymentMethods, {
					name: 'Telebirr (test)',
					kind: 'mobile'
				});
				const cash = await insertReturningId(tx, paymentMethods, {
					name: 'Cash (test)',
					kind: 'cash'
				});
				const pay = (method: number, amount: number, reference: string | null) =>
					insertReturningId(tx, transactions, {
						direction: 'in',
						amount,
						paymentMethodId: method,
						occurredOn: day,
						gatewayReference: reference,
						approvalStatus: 'approved',
						branchId: here.id
					});
				const first = await pay(mobile, 500, 'BX1');
				await pay(mobile, 250, 'BX2');
				const inCash = await pay(cash, 900, null);

				// Read through the rollback, which is what the `reader` parameter is for.
				const before = await transfersOnIn(tx);
				await setReconciled(tx, event, first, true, refusals);
				const ticked = await transfersOnIn(tx);
				let cashRefused = false;
				try {
					await setReconciled(tx, event, inCash, true, refusals);
				} catch (err) {
					cashRefused = err instanceof WriteRefused;
				}
				await setReconciled(tx, event, first, false, refusals);
				const unticked = await transfersOnIn(tx);
				const audits = await tx
					.select()
					.from(auditLog)
					.where(and(eq(auditLog.tableName, 'transactions'), eq(auditLog.recordId, String(first))));
				return { before, ticked, unticked, cashRefused, audits, first };
			});

			expect(result.before.map((r) => r.reference)).toEqual(['BX1', 'BX2']);
			expect(transferTotals(result.before)).toEqual([
				{ method: 'Telebirr (test)', count: 2, total: 750, unchecked: 750 }
			]);
			expect(result.ticked.find((r) => r.id === result.first)?.reconciledAt).not.toBeNull();
			expect(transferTotals(result.ticked)[0].unchecked).toBe(250);
			expect(result.cashRefused).toBe(true);
			expect(result.unticked.find((r) => r.id === result.first)?.reconciledAt).toBeNull();
			expect(result.audits).toHaveLength(2);
		}
	);

	/** `transfersOn` against the rollback: same filters, read through the transaction. */
	async function transfersOnIn(tx: Parameters<Parameters<typeof db.transaction>[0]>[0]) {
		return transfersOn({ active: here.id }, day, tx);
	}
});
