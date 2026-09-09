import { superValidate, message, setError } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { leaseRequestSchema as schema } from './schema';

import { db } from '$lib/server/db';
import { supplies, supplyLeaseItems, supplyLeases } from '$lib/server/db/schema';
import { eq, inArray, sql } from 'drizzle-orm';
import { notDeleted } from '$lib/server/softDelete';
import { logLeaseEvent } from '$lib/server/supplyLeaseFlow';
import { stockBySupply, stockFor } from '$lib/server/supplyStock';
import { sites, supplyItems } from '$lib/server/fastData';
import { redirect } from 'sveltekit-flash-message/server';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const form = await superValidate(zod4(schema));
	const siteList = await sites();
	const items = await supplyItems();

	// The form needs what is actually claimable, not just what is on the shelf:
	// stock already promised to an approved lease is spoken for.
	const stock = await stockBySupply(items.map((item) => item.value));

	const itemList = items.map((item) => {
		const figures = stockFor(item.value, item.quantity, stock);
		return {
			...item,
			onHand: figures.onHand,
			reserved: figures.reserved,
			leasedOut: figures.leasedOut,
			available: figures.available
		};
	});

	return { form, siteList, itemList };
};

export const actions: Actions = {
	add: async ({ request, locals, cookies }) => {
		const form = await superValidate(request, zod4(schema));

		if (!form.valid) {
			return message(form, { type: 'error', text: 'Please check the form for errors.' });
		}

		const userId = locals.user?.id;
		if (!userId) {
			return message(form, { type: 'error', text: 'Your session has expired. Sign in again.' });
		}

		const { siteId, reason, referenceNumber, expectedReturnDate, items } = form.data;

		// Re-read the supplies under the write. The list the form rendered with
		// may be minutes old, and `returnable` has to be snapshotted from the
		// database rather than trusted from the client.
		const supplyIds = items.map((item) => item.supplyId);
		const rows = await db
			.select({
				id: supplies.id,
				name: supplies.name,
				quantity: supplies.quantity,
				returnable: supplies.returnable
			})
			.from(supplies)
			.where(inArray(supplies.id, supplyIds));

		const bySupply = new Map(rows.map((row) => [row.id, row]));
		const missing = supplyIds.filter((id) => !bySupply.has(id));
		if (missing.length) {
			return message(form, {
				type: 'error',
				text: 'One of those supply items no longer exists. Reload the page and try again.'
			});
		}

		const stock = await stockBySupply(supplyIds);

		for (const [index, line] of items.entries()) {
			const supply = bySupply.get(line.supplyId)!;
			const { available } = stockFor(supply.id, supply.quantity, stock);

			if (line.quantity > available) {
				return setError(
					form,
					`items[${index}].quantity`,
					`Only ${available} ${supply.name} can be claimed right now (rest is in store but already promised).`
				);
			}
		}

		const anyReturnable = items.some((line) => bySupply.get(line.supplyId)?.returnable);

		let leaseId: number;

		try {
			leaseId = await db.transaction(async (tx) => {
				const [created] = await tx
					.insert(supplyLeases)
					.values({
						siteId,
						reason,
						referenceNumber: referenceNumber?.trim() || null,
						// A due date only means something when something is coming back.
						expectedReturnDate:
							anyReturnable && expectedReturnDate ? new Date(expectedReturnDate) : null,
						status: 'pending',
						requestedBy: userId,
						requestedAt: sql`NOW()`,
						createdBy: userId
					})
					.$returningId();

				await tx.insert(supplyLeaseItems).values(
					items.map((line) => ({
						leaseId: created.id,
						supplyId: line.supplyId,
						quantityRequested: line.quantity,
						// Snapshot: flipping `returnable` on the supply later must not
						// rewrite what an open lease owes.
						returnable: Boolean(bySupply.get(line.supplyId)?.returnable),
						notes: line.notes?.trim() || null,
						createdBy: userId
					}))
				);

				await logLeaseEvent(tx, {
					leaseId: created.id,
					fromStatus: null,
					toStatus: 'pending',
					actedBy: userId,
					note: reason
				});

				return created.id;
			});
		} catch (err) {
			console.error('Error creating lease:', err);
			return message(form, {
				type: 'error',
				text: `Could not create the lease: ${err instanceof Error ? err.message : 'Unknown error'}`
			});
		}

		redirect(
			`/dashboard/supplies/leases/${leaseId}`,
			{ type: 'success', message: 'Lease requested. It now needs approval.' },
			cookies
		);
	}
};
