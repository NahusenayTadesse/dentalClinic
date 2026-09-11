import { db } from '$lib/server/db';
import {
	transactions,
	transactionSupplies,
	user,
	suppliesAdjustments,
	damagedSupplies,
	employee
} from '$lib/server/db/schema';
import { and, asc, eq, sql } from 'drizzle-orm';
import { notDeleted, softDeleteDamagedSupply } from '$lib/server/softDelete';
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
			id: damagedSupplies.id,
			date: sql<string>`DATE_FORMAT(${damagedSupplies.createdAt}, '%W %Y-%m-%d')`,
			quantity: damagedSupplies.quantity,
			reason: damagedSupplies.reason,
			damagedBy: sql<string>`CONCAT(${employee.name}, ' ', ${employee.fatherName})`,
			damagedById: damagedSupplies.damagedBy,
			changedById: user.id,
			changedBy: user.name
		})
		.from(damagedSupplies)
		.leftJoin(user, eq(damagedSupplies.createdBy, user.id))
		.leftJoin(employee, and(eq(employee.id, damagedSupplies.damagedBy), notDeleted(employee)))
		.where(
			and(
				eq(damagedSupplies.supplyId, Number(id)),
				currentMonthFilter(damagedSupplies.createdAt, start, end),
				notDeleted(damagedSupplies)
			)
		)
		.orderBy(asc(damagedSupplies.createdAt));

	return {
		allTransactions,
		start,
		end
	};
};

export const actions: Actions = {
	/**
	 * Soft delete of one damage report. Super admin only — `requireSuperAdmin`
	 * throws 403 rather than failing quietly, because the hidden button is UX,
	 * not access control.
	 *
	 * The helper puts the damaged units back into the lot they came out of, since
	 * filing the report is what took them out.
	 */
	delete: async ({ request, params, locals, cookies }) => {
		requireSuperAdmin(locals);

		const data = await request.formData();
		const damagedId = Number(data.get('id'));

		if (!damagedId) {
			setFlash({ type: 'error', message: 'No damage report was selected.' }, cookies);
			return fail(400);
		}

		try {
			const deleted = await db.transaction(async (tx) =>
				softDeleteDamagedSupply(tx, damagedId, Number(params.id), locals.user?.id)
			);

			if (!deleted) {
				// Either already gone, or the id belongs to a different supply.
				setFlash({ type: 'error', message: 'That damage report was not found.' }, cookies);
				return fail(404);
			}
		} catch (err) {
			console.error('Error deleting damage report:', err);
			setFlash(
				{
					type: 'error',
					message: `Could not delete damage report: ${err instanceof Error ? err.message : 'Unknown error'}`
				},
				cookies
			);
			return fail(500);
		}

		setFlash({ type: 'success', message: 'Damage report deleted and stock restored.' }, cookies);
		return { success: true };
	}
};
