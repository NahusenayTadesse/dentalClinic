import { auth } from '$lib/server/auth';
import { fail } from '@sveltejs/kit';
import { redirect } from 'sveltekit-flash-message/server';

import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { appointment, procedures, supplies, transactions } from '$lib/server/db/schema';
import { isApproved } from '$lib/server/approvals';
import { lte, sql, and, inArray } from 'drizzle-orm';
import { notDeleted } from '$lib/server/softDelete';
import { onHand } from '$lib/server/stock';
export const load: PageServerLoad = async ({ locals }) => {
	const reorderSupplies = await db
		.select({
			name: supplies.name,
			quantity: onHand()
		})
		.from(supplies)
		.where(and(lte(onHand(), supplies.reorderLevel), notDeleted(supplies)));

	/*
	 * Today's figures, derived.
	 *
	 * These used to come from a `reports` table holding one pre-computed row per day. It is gone:
	 * of its twelve columns only two were ever written, so this panel has been rendering nulls for
	 * every figure but one. A number nobody maintains is worse than a join — the join is always
	 * right, and it is six correlated subqueries over indexed date columns rather than anything
	 * that needs pre-aggregating.
	 */
	const [todayReport] = await db
		.select({
			dailyIncome: sql<number>`(
				SELECT COALESCE(SUM(${transactions.amount}), 0) FROM ${transactions}
				WHERE ${transactions.direction} = 'in' AND ${transactions.occurredOn} = CURDATE()
					AND ${transactions.deletedAt} IS NULL)`,
			dailyExpenses: sql<number>`(
				SELECT COALESCE(ABS(SUM(${transactions.amount})), 0) FROM ${transactions}
				WHERE ${transactions.direction} = 'out' AND ${transactions.occurredOn} = CURDATE()
					AND ${transactions.deletedAt} IS NULL)`,
			staffPaid: sql<number>`(
				SELECT COALESCE(ABS(SUM(t.amount)), 0) FROM transactions t
				JOIN payroll_receipts pr ON pr.transaction_id = t.id
				WHERE t.occurred_on = CURDATE() AND t.deleted_at IS NULL)`,
			transactions: sql<number>`(
				SELECT COUNT(*) FROM ${transactions}
				WHERE ${transactions.occurredOn} = CURDATE() AND ${transactions.deletedAt} IS NULL)`,
			bookedAppointments: sql<number>`(
				SELECT COUNT(*) FROM ${appointment}
				WHERE DATE(${appointment.startsAt}) = CURDATE() AND ${appointment.deletedAt} IS NULL)`,
			serviceRendered: sql<number>`(
				SELECT COUNT(*) FROM ${procedures}
				WHERE ${procedures.completedOn} = CURDATE() AND ${procedures.deletedAt} IS NULL)`,
			productsSold: sql<number>`(
				SELECT COALESCE(ABS(SUM(a.adjustment)), 0) FROM supplies_adjustments a
				WHERE a.movement_type = 'dispensed' AND DATE(a.created_at) = CURDATE()
					AND a.deleted_at IS NULL)`
		})
		.from(sql`(SELECT 1) AS one`);

	/*
	 * The headline panel here used to be expiring branch contracts, plus a write that auto-expired
	 * any that had run out. Both went with the client-billing tables; the home page needs a new
	 * headline built from clinic data.
	 */

	return {
		reorderSupplies,
		todayReport
	};
};

export const actions: Actions = {
	logout: async (event) => {
		if (!event.locals.session) {
			return fail(401);
		}

		// Better Auth clears the session row and the cookie; the cookie write goes back through
		// the SvelteKit cookies plugin, so nothing has to be cleared by hand here.
		await auth.api.signOut({ headers: event.request.headers });

		redirect('/login', { type: 'success', message: 'Logout Successful' }, event.cookies);
	}
};
