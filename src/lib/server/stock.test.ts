import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';

import { inRollback, type TestTx } from '$lib/testing/rollback';
import { db } from './db';
import { addClinicDays, clinicToday } from '$lib/clinicTime';
import { expiringLots, lotRecipients, moveStock } from './stock';
import { softDeleteDamagedSupply } from './softDelete';
import { insertReturningId } from './db/insert';
import { damagedSupplies, patient, supplies, suppliesAdjustments, supplyTypes } from './db/schema';
import { supplyBatch } from './db/schema/batches';

/**
 * Which box stock leaves from. Once deliveries carried expiry dates, soonest-first would have
 * issued the expired box ahead of every good one; and a damage report spanning two lots came back
 * doubled when undone. Both are rules about real rows, so these run against the database.
 */

/** An item with three lots: expired yesterday (2), in date next month (3), and undated (5). */
async function stocked(tx: TestTx) {
	const typeId = await insertReturningId(tx, supplyTypes, { name: 'Stock test type' });
	const supplyId = await insertReturningId(tx, supplies, {
		supplyTypeId: typeId,
		name: 'Stock test anaesthetic',
		tracksExpiry: true
	});

	const today = clinicToday();
	const lot = (quantity: number, expiryDate: string | null) =>
		insertReturningId(tx, supplyBatch, {
			supplyId,
			quantity,
			receivedQuantity: quantity,
			expiryDate,
			receivedOn: today
		});

	return {
		supplyId,
		expired: await lot(2, addClinicDays(today, -1)),
		dated: await lot(3, addClinicDays(today, 30)),
		undated: await lot(5, null)
	};
}

async function quantities(tx: TestTx, ids: number[]) {
	const out: number[] = [];
	for (const id of ids) {
		const [row] = await tx
			.select({ quantity: supplyBatch.quantity })
			.from(supplyBatch)
			.where(eq(supplyBatch.id, id));
		out.push(row.quantity);
	}
	return out;
}

describe('moveStock', () => {
	it('issues from the soonest in-date lot and never from an expired one', async () => {
		const result = await inRollback(async (tx) => {
			const item = await stocked(tx);
			const touched = await moveStock(tx, { supplyId: item.supplyId, delta: -4 });
			return {
				touched: touched.map((t) => [t.batchId === item.dated ? 'dated' : 'undated', t.quantity]),
				left: await quantities(tx, [item.expired, item.dated, item.undated])
			};
		});

		expect(result.touched).toEqual([
			['dated', -3],
			['undated', -1]
		]);
		expect(result.left).toEqual([2, 0, 4]);
	});

	it('comes back short rather than dipping into expired stock', async () => {
		const moved = await inRollback(async (tx) => {
			const item = await stocked(tx);
			const touched = await moveStock(tx, { supplyId: item.supplyId, delta: -10 });
			return touched.reduce((sum, t) => sum - t.quantity, 0);
		});
		expect(moved).toBe(8);
	});

	it('writes expired stock off first when asked to', async () => {
		const left = await inRollback(async (tx) => {
			const item = await stocked(tx);
			await moveStock(tx, { supplyId: item.supplyId, delta: -2, includeExpired: true });
			return quantities(tx, [item.expired, item.dated, item.undated]);
		});
		expect(left).toEqual([0, 3, 5]);
	});
});

describe('undoing a damage report', () => {
	it('returns to each lot exactly what came out of it', async () => {
		const left = await inRollback(async (tx) => {
			const item = await stocked(tx);
			const damagedId = await insertReturningId(tx, damagedSupplies, {
				supplyId: item.supplyId,
				quantity: 4,
				reason: 'Stock test'
			});
			// Spans two lots: the expired 2 and 2 of the dated 3.
			const touched = await moveStock(tx, {
				supplyId: item.supplyId,
				delta: -4,
				includeExpired: true
			});
			for (const lot of touched) {
				await tx.insert(suppliesAdjustments).values({
					suppliesId: item.supplyId,
					adjustment: lot.quantity,
					batchId: lot.batchId,
					damagedSuppliesId: damagedId,
					movementType: 'damaged',
					reason: 'Stock test'
				});
			}

			await softDeleteDamagedSupply(tx, damagedId, item.supplyId);
			return quantities(tx, [item.expired, item.dated, item.undated]);
		});

		expect(left).toEqual([2, 3, 5]);
	});
});

describe('reading lots', async () => {
	// Borrowed: a patient row needs a dozen unrelated columns (CLAUDE.md §16).
	const [someone] = await db.select({ id: patient.id }).from(patient).limit(1);

	it.skipIf(!someone)(
		'traces a lot to the patients it was dispensed to, and no one else',
		async () => {
			const found = await inRollback(async (tx) => {
				const item = await stocked(tx);
				const [{ batchId, quantity }] = await moveStock(tx, { supplyId: item.supplyId, delta: -1 });
				// One dispense naming the patient, one correction naming nobody.
				await tx.insert(suppliesAdjustments).values({
					suppliesId: item.supplyId,
					adjustment: quantity,
					batchId,
					movementType: 'dispensed',
					patientId: someone.id
				});
				await tx.insert(suppliesAdjustments).values({
					suppliesId: item.supplyId,
					adjustment: -1,
					batchId,
					movementType: 'correction'
				});
				return { batchId, rows: await lotRecipients(item.supplyId, tx) };
			});

			expect(found.rows).toHaveLength(1);
			expect(found.rows[0]).toMatchObject({ patientId: someone.id, batchId: found.batchId });
		}
	);

	it('warns of lots expiring soon or expired on the shelf, not far-off or empty ones', async () => {
		const ids = await inRollback(async (tx) => {
			const item = await stocked(tx);
			const today = clinicToday();
			const farOff = await insertReturningId(tx, supplyBatch, {
				supplyId: item.supplyId,
				quantity: 4,
				expiryDate: addClinicDays(today, 400)
			});
			const emptied = await insertReturningId(tx, supplyBatch, {
				supplyId: item.supplyId,
				quantity: 0,
				expiryDate: addClinicDays(today, 5)
			});
			const lots = await expiringLots({ active: null }, 90, tx);
			return { item, farOff, emptied, found: lots.map((l) => l.id) };
		});

		expect(ids.found).toContain(ids.item.expired);
		expect(ids.found).toContain(ids.item.dated);
		expect(ids.found).not.toContain(ids.item.undated);
		expect(ids.found).not.toContain(ids.farOff);
		expect(ids.found).not.toContain(ids.emptied);
	});
});
