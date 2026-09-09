// Seeds a handful of pending records into each approval queue, so the screens have something to
// show while they are being worked on.
//
// Rather than inventing records, this takes existing approved rows and flips them back to
// pending with a requester attached. That keeps every foreign key valid and every row realistic,
// and `resetSeededApprovals` puts them all back.
//
// Run with:  npx vitest run src/lib/server/seedApprovals.test.ts
import { and, eq, inArray, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { APPROVAL_ENTITIES, type ApprovalEntity } from '$lib/server/approvals';
import { user } from '$lib/server/db/schema';

/** Two different users, so the distinct-actor rule can actually be exercised. */
async function requesters(): Promise<string[]> {
	const users = await db.select({ id: user.id }).from(user).limit(2);
	if (users.length === 0) throw new Error('No users to attribute requests to.');
	return users.map((u) => u.id);
}

async function seedEntity(entity: ApprovalEntity, ids: string[], howMany: number) {
	const t = entity.table;

	const rows = await db
		.select({ id: t.id })
		.from(t)
		.where(eq(t.approvalStatus, 'approved'))
		.limit(howMany);

	if (rows.length === 0) return 0;

	// Alternate the requester so at least one queue entry belongs to each user.
	for (const [i, row] of rows.entries()) {
		await db
			.update(t)
			.set({ approvalStatus: 'pending', requestedBy: ids[i % ids.length] })
			.where(eq(t.id, row.id));
	}

	return rows.length;
}

export async function seedApprovals(perQueue = 3): Promise<Record<string, number>> {
	const ids = await requesters();
	const seeded: Record<string, number> = {};

	for (const entity of APPROVAL_ENTITIES) {
		seeded[entity.key] = await seedEntity(entity, ids, perQueue);
	}

	return seeded;
}

/** Puts every pending row back to approved and clears the approval actors. */
export async function resetSeededApprovals(): Promise<Record<string, number>> {
	const reset: Record<string, number> = {};

	for (const entity of APPROVAL_ENTITIES) {
		const t = entity.table;
		const rows = await db
			.select({ n: sql<number>`COUNT(*)` })
			.from(t)
			.where(sql`${t.approvalStatus} <> 'approved'`);

		await db.update(t).set({
			approvalStatus: 'approved',
			requestedBy: null,
			approvedBy: null,
			approvedAt: null,
			rejectedBy: null,
			rejectedAt: null,
			rejectionReason: null,
			approvalOverridden: false
		});

		reset[entity.key] = Number(rows[0]?.n ?? 0);
	}

	return reset;
}
