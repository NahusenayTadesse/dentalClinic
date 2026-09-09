/**
 * Derived stock figures for supplies that are out on lease.
 *
 * The company owns its supplies whether they sit in the store or at a site, so
 * a lease is a location change, not a disposal. That gives four numbers, and
 * only the first is stored:
 *
 *   on hand     `supplies.quantity`, the running total kept by adjustments
 *   reserved    approved on a lease but not yet handed over
 *   leased out  issued and not yet returned (returnable lines only)
 *   total owned on hand + leased out
 *
 * Reserved and leased-out are summed from the lease rows on every read rather
 * than cached on `supplies`, so they cannot drift away from the history that
 * explains them. See `supplyLeases.ts` in the schema for the shape.
 */

import { db } from '$lib/server/db';
import { supplyLeases, supplyLeaseItems } from '$lib/server/db/schema';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { notDeleted } from '$lib/server/softDelete';

/**
 * Statuses in which a lease still has a claim on stock. A `pending` request has
 * no claim — nothing is committed until someone approves it — and `rejected`,
 * `cancelled` and `closed` leases have released theirs.
 */
export const COMMITTED_STATUSES = ['approved', 'issued', 'partially_returned'] as const;

/** Statuses in which goods are physically at the site. */
export const AT_SITE_STATUSES = ['issued', 'partially_returned'] as const;

/**
 * Approved but not yet handed over. Counted for `issued` leases too: approving
 * 10 and issuing 6 leaves 4 still committed to that site, and dropping them
 * from the figure the moment the first box goes out would quietly free stock
 * that is still promised.
 */
const reservedSql = sql<number>`COALESCE(SUM(CASE
	WHEN ${supplyLeases.status} IN ('approved', 'issued', 'partially_returned')
	THEN GREATEST(${supplyLeaseItems.quantityApproved} - ${supplyLeaseItems.quantityIssued}, 0)
	ELSE 0 END), 0)`;

/**
 * Out at a site and still owed back. Only returnable lines count: a consumable
 * is gone the moment it is issued, which the negative stock adjustment already
 * recorded.
 */
const leasedOutSql = sql<number>`COALESCE(SUM(CASE
	WHEN ${supplyLeaseItems.returnable} = 1
		AND ${supplyLeases.status} IN ('issued', 'partially_returned')
	THEN GREATEST(${supplyLeaseItems.quantityIssued}
		- ${supplyLeaseItems.quantityReturned}
		- ${supplyLeaseItems.quantityWrittenOff}, 0)
	ELSE 0 END), 0)`;

export type SupplyStock = {
	reserved: number;
	leasedOut: number;
};

/**
 * Reserved and leased-out quantities keyed by supply id. Supplies with no lease
 * history are absent from the map — callers should treat a miss as zeroes,
 * which `stockFor` below does.
 */
export async function stockBySupply(supplyIds?: number[]): Promise<Map<number, SupplyStock>> {
	// An explicit empty list means "no supplies", not "all supplies".
	if (supplyIds && supplyIds.length === 0) return new Map();

	const rows = await db
		.select({
			supplyId: supplyLeaseItems.supplyId,
			reserved: reservedSql,
			leasedOut: leasedOutSql
		})
		.from(supplyLeaseItems)
		.innerJoin(
			supplyLeases,
			and(eq(supplyLeases.id, supplyLeaseItems.leaseId), notDeleted(supplyLeases))
		)
		.where(
			and(
				notDeleted(supplyLeaseItems),
				supplyIds ? inArray(supplyLeaseItems.supplyId, supplyIds) : undefined
			)
		)
		.groupBy(supplyLeaseItems.supplyId);

	return new Map(
		rows.map((row) => [
			row.supplyId,
			{ reserved: Number(row.reserved ?? 0), leasedOut: Number(row.leasedOut ?? 0) }
		])
	);
}

/** The four figures for one supply, given its stored on-hand quantity. */
export function stockFor(
	supplyId: number,
	onHand: number | null | undefined,
	map: Map<number, SupplyStock>
) {
	const { reserved, leasedOut } = map.get(supplyId) ?? { reserved: 0, leasedOut: 0 };
	const inStore = Number(onHand ?? 0);

	return {
		onHand: inStore,
		reserved,
		leasedOut,
		totalOwned: inStore + leasedOut,
		/** What a new lease may still claim. Never negative. */
		available: Math.max(inStore - reserved, 0)
	};
}

/**
 * How much of one supply a new lease can still claim, read inside the same
 * transaction that is about to commit it. The list pages use `stockBySupply`;
 * this exists so approving a lease can re-check the number under the write
 * rather than trusting what the form was rendered with.
 */
export async function availableToLease(
	tx: Parameters<Parameters<typeof db.transaction>[0]>[0] | typeof db,
	supplyId: number,
	onHand: number
): Promise<number> {
	const [row] = await tx
		.select({ reserved: reservedSql })
		.from(supplyLeaseItems)
		.innerJoin(
			supplyLeases,
			and(eq(supplyLeases.id, supplyLeaseItems.leaseId), notDeleted(supplyLeases))
		)
		.where(and(eq(supplyLeaseItems.supplyId, supplyId), notDeleted(supplyLeaseItems)));

	return Math.max(onHand - Number(row?.reserved ?? 0), 0);
}
