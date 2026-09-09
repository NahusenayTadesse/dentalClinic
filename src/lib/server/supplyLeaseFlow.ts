/**
 * Moving a lease through its lifecycle.
 *
 *   pending -> approved -> issued -> partially_returned -> returned -> closed
 *      |           |
 *      v           v
 *   rejected    cancelled
 *
 * Every transition here does three things together, inside one transaction:
 * writes the movement rows, keeps `supplies.quantity` correct, and appends to
 * `supply_lease_events`. `supplies.quantity` is a *running total*, not a figure
 * derived from its history, so a hand-over that forgets to adjust it leaves the
 * stock count disagreeing with the lease that is supposed to explain it — the
 * same trap `softDeleteSupplyAdjustment` exists to avoid.
 */

import { db } from '$lib/server/db';
import {
	supplies,
	suppliesAdjustments,
	supplyLeases,
	supplyLeaseEvents,
	supplyLeaseItems,
	supplyLeaseMovements
} from '$lib/server/db/schema';
import { and, eq, sql } from 'drizzle-orm';
import { notDeleted } from '$lib/server/softDelete';
import { LEASE_STATUS_LABELS, type LeaseStatus } from '$lib/leaseStatus';

export { LEASE_STATUS_LABELS };
export type { LeaseStatus };

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
/** Reads work the same on the pool or inside a transaction. */
type DbOrTx = Tx | typeof db;

/** Which transitions are legal. The UI hides the rest; this is the real gate. */
const ALLOWED: Record<LeaseStatus, LeaseStatus[]> = {
	pending: ['approved', 'rejected', 'cancelled'],
	approved: ['issued', 'cancelled'],
	issued: ['partially_returned', 'returned', 'closed'],
	partially_returned: ['partially_returned', 'returned', 'closed'],
	returned: ['closed'],
	rejected: [],
	cancelled: [],
	closed: []
};

export function canTransition(from: LeaseStatus, to: LeaseStatus): boolean {
	return ALLOWED[from]?.includes(to) ?? false;
}

/** A lease still open enough to accept goods movements. */
export function isOpen(status: LeaseStatus): boolean {
	return ['approved', 'issued', 'partially_returned'].includes(status);
}

/**
 * Appends to the audit log. Called by every transition — the actor columns on
 * `supply_leases` record the latest approver, this records all of them.
 */
export async function logLeaseEvent(
	tx: Tx,
	input: {
		leaseId: number;
		fromStatus: LeaseStatus | null;
		toStatus: LeaseStatus;
		actedBy: string;
		note?: string | null;
	}
) {
	await tx.insert(supplyLeaseEvents).values({
		leaseId: input.leaseId,
		fromStatus: input.fromStatus,
		toStatus: input.toStatus,
		actedBy: input.actedBy,
		actedAt: sql`NOW()`,
		note: input.note ?? null,
		createdBy: input.actedBy
	});
}

/** The lease header plus the numbers a transition needs to validate against. */
export async function loadLeaseForUpdate(tx: DbOrTx, leaseId: number) {
	const [lease] = await tx
		.select({
			id: supplyLeases.id,
			status: supplyLeases.status,
			siteId: supplyLeases.siteId
		})
		.from(supplyLeases)
		.where(and(eq(supplyLeases.id, leaseId), notDeleted(supplyLeases)))
		.limit(1);

	return lease as { id: number; status: LeaseStatus; siteId: number } | undefined;
}

export async function loadLeaseItems(tx: DbOrTx, leaseId: number) {
	return tx
		.select({
			id: supplyLeaseItems.id,
			supplyId: supplyLeaseItems.supplyId,
			name: supplies.name,
			unitOfMeasure: supplies.unitOfMeasure,
			onHand: supplies.quantity,
			quantityRequested: supplyLeaseItems.quantityRequested,
			quantityApproved: supplyLeaseItems.quantityApproved,
			quantityIssued: supplyLeaseItems.quantityIssued,
			quantityReturned: supplyLeaseItems.quantityReturned,
			quantityWrittenOff: supplyLeaseItems.quantityWrittenOff,
			returnable: supplyLeaseItems.returnable,
			unitCost: supplyLeaseItems.unitCost,
			notes: supplyLeaseItems.notes
		})
		.from(supplyLeaseItems)
		.innerJoin(supplies, eq(supplies.id, supplyLeaseItems.supplyId))
		.where(and(eq(supplyLeaseItems.leaseId, leaseId), notDeleted(supplyLeaseItems)))
		.orderBy(supplyLeaseItems.id);
}

/**
 * Hands stock over to the site.
 *
 * Each line writes a negative `supplies_adjustments` row and decrements
 * `supplies.quantity`, because the goods have physically left the store. What
 * separates a lease from a plain removal is that returnable lines are still
 * counted as owned — see `stockBySupply` in `supplyStock.ts`, which adds them
 * back into "total owned" from the lease rows rather than from stock.
 */
export async function issueLeaseItems(
	tx: Tx,
	input: {
		leaseId: number;
		lines: { itemId: number; quantity: number }[];
		userId: string;
		receivedByName?: string | null;
		receivedByPhone?: string | null;
		note?: string | null;
	}
): Promise<{ issued: number }> {
	const items = await loadLeaseItems(tx, input.leaseId);
	const byId = new Map(items.map((item) => [item.id, item]));
	let issued = 0;

	for (const line of input.lines) {
		const quantity = Number(line.quantity);
		if (!quantity || quantity <= 0) continue;

		const item = byId.get(line.itemId);
		// The item id comes from the client, so it is re-checked against this
		// lease's own lines rather than trusted as a primary key.
		if (!item) throw new Error('That item does not belong to this lease.');

		const outstanding = item.quantityApproved - item.quantityIssued;
		if (quantity > outstanding) {
			throw new Error(
				`Cannot issue ${quantity} ${item.name} — only ${outstanding} were approved and not yet issued.`
			);
		}
		if (quantity > Number(item.onHand ?? 0)) {
			throw new Error(
				`Cannot issue ${quantity} ${item.name} — only ${item.onHand} are in the store.`
			);
		}

		const [adjustment] = await tx
			.insert(suppliesAdjustments)
			.values({
				suppliesId: item.supplyId,
				adjustment: -quantity,
				reason: `Leased to site (lease #${input.leaseId})`,
				createdBy: input.userId
			})
			.$returningId();

		await tx.insert(supplyLeaseMovements).values({
			leaseItemId: item.id,
			movementType: 'issue',
			quantity,
			adjustmentId: adjustment.id,
			reason: input.note ?? null,
			performedBy: input.userId,
			performedAt: sql`NOW()`,
			createdBy: input.userId
		});

		await tx
			.update(supplyLeaseItems)
			.set({
				quantityIssued: sql`${supplyLeaseItems.quantityIssued} + ${quantity}`,
				updatedBy: input.userId
			})
			.where(eq(supplyLeaseItems.id, item.id));

		await tx
			.update(supplies)
			.set({
				quantity: sql`${supplies.quantity} - ${quantity}`,
				updatedBy: input.userId
			})
			.where(eq(supplies.id, item.supplyId));

		issued += quantity;
	}

	if (!issued) throw new Error('Enter a quantity for at least one item.');

	const lease = await loadLeaseForUpdate(tx, input.leaseId);
	if (!lease) throw new Error('Lease not found.');

	await tx
		.update(supplyLeases)
		.set({
			status: 'issued',
			issuedBy: input.userId,
			issuedAt: sql`NOW()`,
			receivedByName: input.receivedByName || null,
			receivedByPhone: input.receivedByPhone || null,
			updatedBy: input.userId
		})
		.where(eq(supplyLeases.id, input.leaseId));

	await logLeaseEvent(tx, {
		leaseId: input.leaseId,
		fromStatus: lease.status,
		toStatus: 'issued',
		actedBy: input.userId,
		note: input.note ?? `Issued ${issued} unit(s)`
	});

	return { issued };
}

export type ReturnCondition = 'good' | 'damaged' | 'lost';

/**
 * Takes stock back from the site.
 *
 * Only goods returned in `good` condition go back on the shelf, so only those
 * write a positive adjustment. `damaged` and `lost` units are written off: they
 * left the store on issue and are never coming back, so total owned drops,
 * which is exactly right.
 *
 * No `damaged_supplies` row is written here on purpose. That table's own delete
 * helper adds its quantity *back* to `supplies.quantity`, which assumes the
 * damage was reported against stock sitting in the store. A lease write-off
 * never re-entered the store, so a row there would put phantom units back if it
 * were ever deleted.
 */
export async function returnLeaseItems(
	tx: Tx,
	input: {
		leaseId: number;
		lines: { itemId: number; quantity: number; condition: ReturnCondition }[];
		userId: string;
		reason?: string | null;
	}
): Promise<{ returned: number; writtenOff: number; status: LeaseStatus }> {
	const lease = await loadLeaseForUpdate(tx, input.leaseId);
	if (!lease) throw new Error('Lease not found.');

	const items = await loadLeaseItems(tx, input.leaseId);
	const byId = new Map(items.map((item) => [item.id, item]));
	// Local tally so the outstanding check below sees this batch's own effect.
	const applied = new Map<number, number>();
	let returned = 0;
	let writtenOff = 0;

	for (const line of input.lines) {
		const quantity = Number(line.quantity);
		if (!quantity || quantity <= 0) continue;

		const item = byId.get(line.itemId);
		if (!item) throw new Error('That item does not belong to this lease.');

		if (!item.returnable) {
			throw new Error(`${item.name} was issued as a consumable — it is not expected back.`);
		}

		const alreadyApplied = applied.get(item.id) ?? 0;
		const outstanding =
			item.quantityIssued - item.quantityReturned - item.quantityWrittenOff - alreadyApplied;

		if (quantity > outstanding) {
			throw new Error(
				`Cannot return ${quantity} ${item.name} — only ${outstanding} are still out.`
			);
		}

		const backOnShelf = line.condition === 'good';
		let adjustmentId: number | null = null;

		if (backOnShelf) {
			const [adjustment] = await tx
				.insert(suppliesAdjustments)
				.values({
					suppliesId: item.supplyId,
					adjustment: quantity,
					reason: `Returned from site (lease #${input.leaseId})`,
					createdBy: input.userId
				})
				.$returningId();

			adjustmentId = adjustment.id;

			await tx
				.update(supplies)
				.set({
					quantity: sql`${supplies.quantity} + ${quantity}`,
					updatedBy: input.userId
				})
				.where(eq(supplies.id, item.supplyId));
		}

		await tx.insert(supplyLeaseMovements).values({
			leaseItemId: item.id,
			movementType: backOnShelf ? 'return' : 'write_off',
			quantity,
			condition: line.condition,
			adjustmentId,
			reason: input.reason ?? null,
			performedBy: input.userId,
			performedAt: sql`NOW()`,
			createdBy: input.userId
		});

		await tx
			.update(supplyLeaseItems)
			.set(
				backOnShelf
					? {
							quantityReturned: sql`${supplyLeaseItems.quantityReturned} + ${quantity}`,
							updatedBy: input.userId
						}
					: {
							quantityWrittenOff: sql`${supplyLeaseItems.quantityWrittenOff} + ${quantity}`,
							updatedBy: input.userId
						}
			)
			.where(eq(supplyLeaseItems.id, item.id));

		applied.set(item.id, alreadyApplied + quantity);
		if (backOnShelf) returned += quantity;
		else writtenOff += quantity;
	}

	if (!returned && !writtenOff) throw new Error('Enter a quantity for at least one item.');

	// Everything still owed across the whole lease, this batch included.
	const stillOut = items.reduce((total, item) => {
		if (!item.returnable) return total;
		const settled = applied.get(item.id) ?? 0;
		return (
			total +
			Math.max(item.quantityIssued - item.quantityReturned - item.quantityWrittenOff - settled, 0)
		);
	}, 0);

	const status: LeaseStatus = stillOut === 0 ? 'returned' : 'partially_returned';

	await tx
		.update(supplyLeases)
		.set({ status, updatedBy: input.userId })
		.where(eq(supplyLeases.id, input.leaseId));

	await logLeaseEvent(tx, {
		leaseId: input.leaseId,
		fromStatus: lease.status,
		toStatus: status,
		actedBy: input.userId,
		note:
			input.reason ??
			`Returned ${returned}, written off ${writtenOff}${stillOut ? `, ${stillOut} still out` : ''}`
	});

	return { returned, writtenOff, status };
}

/**
 * How much of a lease is still physically at the site. Used to stop a lease
 * being closed while it still owes returnable goods.
 */
export async function outstandingOnLease(tx: DbOrTx, leaseId: number): Promise<number> {
	const [row] = await tx
		.select({
			outstanding: sql<number>`COALESCE(SUM(CASE WHEN ${supplyLeaseItems.returnable} = 1
				THEN GREATEST(${supplyLeaseItems.quantityIssued}
					- ${supplyLeaseItems.quantityReturned}
					- ${supplyLeaseItems.quantityWrittenOff}, 0)
				ELSE 0 END), 0)`
		})
		.from(supplyLeaseItems)
		.where(and(eq(supplyLeaseItems.leaseId, leaseId), notDeleted(supplyLeaseItems)));

	return Number(row?.outstanding ?? 0);
}
