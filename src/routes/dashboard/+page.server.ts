import { auth } from '$lib/server/auth';
import { fail } from '@sveltejs/kit';
import { redirect } from 'sveltekit-flash-message/server';

import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { appointment, procedures, supplies, transactions } from '$lib/server/db/schema';
import { lte, sql, and } from 'drizzle-orm';
import { notDeleted } from '$lib/server/softDelete';
import { expiringLots, onHand } from '$lib/server/stock';
import { LOT_WARNING_DAYS } from '$lib/expiry';
import { storedInstant, today } from '$lib/server/db/dialect';
import { clinicDayRange, clinicToday } from '$lib/clinicTime';
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
	// The clinic's day, never `CURDATE`: sessions run in UTC, where that is yesterday until three
	// in the morning here (`db/connection.ts`). Instants are compared as stored (`storedInstant`).
	const day = today();
	const { start, end } = clinicDayRange(clinicToday());
	const from = storedInstant(start);
	const until = storedInstant(end);

	const [todayReport] = await db
		.select({
			dailyIncome: sql<number>`(
				SELECT COALESCE(SUM(${transactions.amount}), 0) FROM ${transactions}
				WHERE ${transactions.direction} = 'in' AND ${transactions.occurredOn} = ${day}
					AND ${transactions.deletedAt} IS NULL)`,
			dailyExpenses: sql<number>`(
				SELECT COALESCE(ABS(SUM(${transactions.amount})), 0) FROM ${transactions}
				WHERE ${transactions.direction} = 'out' AND ${transactions.occurredOn} = ${day}
					AND ${transactions.deletedAt} IS NULL)`,
			staffPaid: sql<number>`(
				SELECT COALESCE(ABS(SUM(t.amount)), 0) FROM transactions t
				JOIN payroll_receipts pr ON pr.transaction_id = t.id
				WHERE t.occurred_on = ${day} AND t.deleted_at IS NULL)`,
			transactions: sql<number>`(
				SELECT COUNT(*) FROM ${transactions}
				WHERE ${transactions.occurredOn} = ${day} AND ${transactions.deletedAt} IS NULL)`,
			bookedAppointments: sql<number>`(
				SELECT COUNT(*) FROM ${appointment}
				WHERE ${appointment.startsAt} >= ${from} AND ${appointment.startsAt} < ${until} AND ${appointment.deletedAt} IS NULL)`,
			serviceRendered: sql<number>`(
				SELECT COUNT(*) FROM ${procedures}
				WHERE ${procedures.completedOn} = ${day} AND ${procedures.deletedAt} IS NULL)`,
			productsSold: sql<number>`(
				SELECT COALESCE(ABS(SUM(a.adjustment)), 0) FROM supplies_adjustments a
				WHERE a.movement_type = 'dispensed' AND a.created_at >= ${from} AND a.created_at < ${until}
					AND a.deleted_at IS NULL)`
		})
		.from(sql`(SELECT 1) AS one`);

	/*
	 * Stock that is going off, at this branch: the box nobody looks at expires unnoticed, and the
	 * box that has expired is the one somebody reaches for. The lot list on each item says the
	 * same, but only to whoever opens that item.
	 */
	const expiring = await expiringLots(locals.branch, LOT_WARNING_DAYS);

	return {
		reorderSupplies,
		expiring,
		today: clinicToday(),
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
