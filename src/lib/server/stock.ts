/**
 * How much of a supply is on hand, and how to change it.
 *
 * Stock used to be a running total on `supplies.quantity`, kept in step by `+=` on every
 * adjustment. That is gone: the quantity is now the sum of the item's open lots, derived on read.
 *
 * The reason is not purity. A cached total is a second copy of a number, and the cost of the
 * second copy is that it can disagree with the first — silently, and usually about stock somebody
 * is about to dispense. The reason it was cached at all was speed, and measured on this database
 * with 300 items, 7,500 lots and 120,000 ledger rows:
 *
 *     cached column                0.6 ms
 *     SUM over open lots           1.6 ms   <- what this module does
 *     SUM over the movement ledger  67.6 ms
 *
 * Summing the *ledger* is the expensive one and it grows without bound, which is what made a cache
 * look necessary. Summing *lots* does not: a supply has a handful of open ones no matter how long
 * the clinic has been trading, because depleted lots drop out of the sum. One millisecond is not
 * worth a number that can lie.
 *
 * Consequence worth knowing: **every supply now carries lots, including the ones that never
 * expire.** A delivery of gloves is a lot with no expiry date rather than no lot at all —
 * otherwise its quantity would derive to zero. `supplies.tracksExpiry` says whether an expiry
 * date is expected on each, not whether lots exist.
 */
import { and, asc, desc, eq, gt, gte, isNotNull, isNull, lte, or, sql } from 'drizzle-orm';
import { db } from './db';
import { supplies, suppliesAdjustments } from './db/schema/inventory';
import { supplyBatch } from './db/schema/batches';
import { patient } from './db/schema/patients';
import { notDeleted } from './softDelete';
import { branchFilter, type BranchContext } from './branchScope';
import { patientFullName } from './patients';
import { addClinicDays, clinicToday } from '../clinicTime';
import type { MySqlTransaction } from 'drizzle-orm/mysql-core';

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * A transaction handle. Drizzle parameterises this by the full schema and the driver, and naming
 * that type here would mean repeating the whole database shape — the same reason `AnyTable` in
 * `crud.ts` is what it is (CLAUDE.md §3).
 */
type Tx = MySqlTransaction<any, any, any, any>;
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * Current stock of a supply, as a correlated subquery.
 *
 * Written this way rather than as a `LEFT JOIN … GROUP BY` because it composes: the same fragment
 * drops into a `SELECT` list, a `WHERE` for the reorder alert, and an `ORDER BY`, without every
 * caller having to grow a `GROUP BY` and every other selected column with it. Measured at the same
 * 2.0 ms as the join form, so the convenience is free.
 *
 *     .select({ name: supplies.name, quantity: onHand() })
 *     .where(lte(onHand(), supplies.reorderLevel))
 *
 * **Every column is spelled with its table**, by name. Drizzle qualifies a column only when the
 * query has a join; in a query on `supplies` alone it wrote `WHERE supply_id = id`, and inside the
 * subquery `id` is the lot's own id — so every item's stock was the sum of whichever lots happened to
 * share its number. The dashboard's low-stock count and the item pages read it that way, and a new
 * item with no lots at all showed hundreds on hand. `stock.test.ts` pins it on a single-table query.
 */
export function onHand() {
	const lot = (column: string) => sql`${sql.identifier('supply_batch')}.${sql.identifier(column)}`;
	return sql<number>`(
		SELECT COALESCE(SUM(${lot('quantity')}), 0)
		FROM ${sql.identifier('supply_batch')}
		WHERE ${lot('supply_id')} = ${sql.identifier('supplies')}.${sql.identifier('id')}
			AND ${lot('status')} = 'active'
			AND ${lot('deleted_at')} IS NULL
	)`;
}

/**
 * Moves stock in or out, and keeps the lots honest.
 *
 * Positive moves create a lot. Negative moves take from the lots that expire soonest — first
 * expiry, first out, which is the rule a dispensary works to and the reason lots exist at all:
 * taking from the newest box while an older one times out on the shelf is exactly what expiry
 * tracking is meant to prevent. A lot that reaches zero is marked `depleted` rather than deleted,
 * so the movements that emptied it still lead somewhere.
 *
 * An issue never takes from a lot past its expiry date: before deliveries carried dates this could
 * not arise, and after, soonest-first would have handed out the expired box before any good one.
 * Expired stock leaves as a write-off, which passes `includeExpired`. A lot expiring today is
 * still in date, the same boundary `$lib/expiry.ts` draws on screen.
 *
 * Returns the lots it touched, so the caller can record which lot a dispense came from — the link
 * a recall is traced through.
 *
 * Does **not** write the ledger row. The caller owns that, because only the caller knows whether
 * this was a delivery, a dispense or a stock count, and inventing a movement type here would put
 * the reason in two places.
 */
export async function moveStock(
	tx: Tx,
	options: {
		supplyId: number;
		/** Positive to receive, negative to issue. */
		delta: number;
		userId?: string;
		/** Only for receipts, and only what the form actually collected. */
		batchNumber?: string | null;
		/** A calendar day, `YYYY-MM-DD`. */
		expiryDate?: string | null;
		unitCost?: number | null;
		supplierId?: number | null;
		/** Only for issues: take from expired lots too. For writing stock off, never for using it. */
		includeExpired?: boolean;
	}
): Promise<{ batchId: number; quantity: number }[]> {
	const { supplyId, delta, userId } = options;

	if (delta === 0) return [];

	if (delta > 0) {
		const [created] = await tx
			.insert(supplyBatch)
			.values({
				supplyId,
				batchNumber: options.batchNumber ?? null,
				expiryDate: options.expiryDate ?? null,
				quantity: delta,
				receivedQuantity: delta,
				unitCost: options.unitCost ?? null,
				supplierId: options.supplierId ?? null,
				// The clinic's day, not the server's (CLAUDE.md §9).
				receivedOn: clinicToday(),
				createdBy: userId
			})
			.$returningId();

		return [{ batchId: created.id, quantity: delta }];
	}

	// Issuing: walk the open lots, soonest expiry first. Lots with no expiry sort last, because a
	// dated box should always leave before an undated one.
	const open = await tx
		.select({ id: supplyBatch.id, quantity: supplyBatch.quantity })
		.from(supplyBatch)
		.where(
			and(
				eq(supplyBatch.supplyId, supplyId),
				eq(supplyBatch.status, 'active'),
				isNull(supplyBatch.deletedAt),
				options.includeExpired
					? undefined
					: or(isNull(supplyBatch.expiryDate), gte(supplyBatch.expiryDate, clinicToday()))
			)
		)
		.orderBy(
			sql`${supplyBatch.expiryDate} IS NULL`,
			asc(supplyBatch.expiryDate),
			asc(supplyBatch.id)
		);

	let remaining = Math.abs(delta);
	const touched: { batchId: number; quantity: number }[] = [];

	for (const lot of open) {
		if (remaining <= 0) break;

		const take = Math.min(lot.quantity, remaining);
		if (take <= 0) continue;

		const left = lot.quantity - take;

		await tx
			.update(supplyBatch)
			.set({
				quantity: left,
				// Marked rather than removed: the movements that emptied it still point here.
				...(left === 0 ? { status: 'depleted' as const } : {}),
				updatedBy: userId
			})
			.where(eq(supplyBatch.id, lot.id));

		touched.push({ batchId: lot.id, quantity: -take });
		remaining -= take;
	}

	/*
	 * Short by design rather than by accident. If the lots do not cover the issue, the shelf and
	 * the system already disagreed before this call, and inventing a negative lot would hide that.
	 * The caller gets back less than it asked for and can say so.
	 */
	return touched;
}

/**
 * Puts stock back into the lot it came out of, for undoing a movement.
 *
 * Used when a ledger row or a damage report is reversed. A depleted lot comes back to `active`,
 * because units returning to it make it usable again.
 */
export async function returnToBatch(tx: Tx, batchId: number, quantity: number, userId?: string) {
	if (quantity <= 0) return;

	await tx
		.update(supplyBatch)
		.set({
			quantity: sql`${supplyBatch.quantity} + ${quantity}`,
			status: 'active',
			updatedBy: userId
		})
		.where(eq(supplyBatch.id, batchId));
}

/**
 * The database, or a transaction on it — so a test can read what its rollback wrote. Typed from
 * `db.transaction` rather than as `Tx` above: a union with the loose `Tx` loses `select`'s overloads.
 */
type Reader = Parameters<Parameters<typeof db.transaction>[0]>[0] | typeof db;

/* ── Reading lots ───────────────────────────────────────────────────────────────────────────── */

/**
 * Lots at this branch that still hold stock and expire within `withinDays` — or already have, and
 * are still on the shelf waiting to be written off. Soonest first. The dashboard's warning: a box
 * nobody looks at expires unnoticed, and a box that has expired is one somebody may still reach for.
 */
export async function expiringLots(
	branch: Pick<BranchContext, 'active'>,
	withinDays: number,
	reader: Reader = db
) {
	const until = addClinicDays(clinicToday(), withinDays);
	return reader
		.select({
			id: supplyBatch.id,
			supplyId: supplyBatch.supplyId,
			supply: supplies.name,
			batchNumber: supplyBatch.batchNumber,
			expiryDate: supplyBatch.expiryDate,
			quantity: supplyBatch.quantity
		})
		.from(supplyBatch)
		.innerJoin(supplies, and(eq(supplies.id, supplyBatch.supplyId), notDeleted(supplies)))
		.where(
			and(
				eq(supplyBatch.status, 'active'),
				gt(supplyBatch.quantity, 0),
				isNotNull(supplyBatch.expiryDate),
				lte(supplyBatch.expiryDate, until),
				notDeleted(supplyBatch),
				branchFilter(supplyBatch.branchId, branch)
			)
		)
		.orderBy(asc(supplyBatch.expiryDate), asc(supplyBatch.id));
}

/**
 * Who received stock of this item, lot by lot — the trace a supplier's recall notice needs: it
 * names a lot number, and this says which patients had it, from which lot, and when. Only
 * movements that named a patient (`dispensed`) are here; stock used without naming one cannot be
 * traced, which is why the issue form asks.
 *
 * Patients are named, so the caller shows this only to someone who may read patient records.
 * Every branch's: a recall does not stop at the door of the branch that received the box.
 */
export async function lotRecipients(supplyId: number, reader: Reader = db) {
	return reader
		.select({
			id: suppliesAdjustments.id,
			batchId: supplyBatch.id,
			batchNumber: supplyBatch.batchNumber,
			expiryDate: supplyBatch.expiryDate,
			patientId: patient.id,
			patient: patientFullName,
			fileNo: patient.fileNo,
			phone: patient.phone,
			quantity: suppliesAdjustments.adjustment,
			at: suppliesAdjustments.createdAt
		})
		.from(suppliesAdjustments)
		.innerJoin(patient, eq(patient.id, suppliesAdjustments.patientId))
		.leftJoin(supplyBatch, eq(supplyBatch.id, suppliesAdjustments.batchId))
		.where(
			and(
				eq(suppliesAdjustments.suppliesId, supplyId),
				eq(suppliesAdjustments.movementType, 'dispensed'),
				notDeleted(suppliesAdjustments)
			)
		)
		.orderBy(desc(suppliesAdjustments.createdAt), desc(suppliesAdjustments.id));
}
