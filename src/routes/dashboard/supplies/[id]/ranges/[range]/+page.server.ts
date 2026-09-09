import { db } from '$lib/server/db';
import {
	transactions,
	transactionSupplies,
	user,
	suppliesAdjustments
} from '$lib/server/db/schema';
import { and, asc, eq, sql } from 'drizzle-orm';
import { notDeleted, softDeleteSupplyAdjustment } from '$lib/server/softDelete';
import { requireSuperAdmin } from '$lib/server/permissions';
import { fail } from '@sveltejs/kit';
import { setFlash } from 'sveltekit-flash-message/server';

import { currentMonthFilter } from '$lib/global.svelte';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const id = Number(params.id);
	const { range } = params as { range: string };

	const [y1, m1, d1, y2, m2, d2] = range.split('-');

	const start = `${y1}-${m1}-${d1}`;
	const end = `${y2}-${m2}-${d2}`;

	const allTransactions = await db
		.select({
			id: suppliesAdjustments.id,
			date: sql<string>`DATE_FORMAT(${suppliesAdjustments.createdAt}, '%W %Y-%m-%d')`,
			quantity: suppliesAdjustments.adjustment,
			reason: suppliesAdjustments.reason,
			costPerItem: suppliesAdjustments.costPerItem,
			changedBy: user.name,
			changedById: user.id,
			reciept: transactions.recieptLink
		})
		.from(suppliesAdjustments)
		.leftJoin(
			transactionSupplies,
			and(
				eq(transactionSupplies.id, suppliesAdjustments.transactionId),
				notDeleted(transactionSupplies)
			)
		)
		.leftJoin(
			transactions,
			and(eq(transactions.id, transactionSupplies.transactionId), notDeleted(transactions))
		)
		.leftJoin(user, eq(suppliesAdjustments.createdBy, user.id))
		.where(
			and(
				eq(suppliesAdjustments.suppliesId, id),
				currentMonthFilter(suppliesAdjustments.createdAt, start, end),
				notDeleted(suppliesAdjustments)
			)
		)
		.orderBy(asc(suppliesAdjustments.createdAt));

	return {
		allTransactions,
		start,
		end
	};
};

export const actions: Actions = {
	/**
	 * Soft delete of one ledger row. Super admin only — `requireSuperAdmin`
	 * throws 403 rather than failing quietly, because the hidden button is UX,
	 * not access control.
	 *
	 * The helper also subtracts the row's adjustment back out of
	 * `supplies.quantity`, which is a running total rather than a figure derived
	 * from this ledger.
	 */
	delete: async ({ request, params, locals, cookies }) => {
		requireSuperAdmin(locals);

		const data = await request.formData();
		const adjustmentId = Number(data.get('id'));

		if (!adjustmentId) {
			setFlash({ type: 'error', message: 'No adjustment was selected.' }, cookies);
			return fail(400);
		}

		try {
			const deleted = await db.transaction(async (tx) =>
				softDeleteSupplyAdjustment(tx, adjustmentId, Number(params.id), locals.user?.id)
			);

			if (!deleted) {
				// Either already gone, or the id belongs to a different supply.
				setFlash({ type: 'error', message: 'That adjustment was not found.' }, cookies);
				return fail(404);
			}
		} catch (err) {
			console.error('Error deleting supply adjustment:', err);
			setFlash(
				{
					type: 'error',
					message: `Could not delete adjustment: ${err instanceof Error ? err.message : 'Unknown error'}`
				},
				cookies
			);
			return fail(500);
		}

		setFlash({ type: 'success', message: 'Adjustment deleted and stock corrected.' }, cookies);
		return { success: true };
	}
};
