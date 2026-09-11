import { auth } from '$lib/server/auth';
import { fail } from '@sveltejs/kit';
import { redirect } from 'sveltekit-flash-message/server';

import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { reports, supplies } from '$lib/server/db/schema';
import { isApproved } from '$lib/server/approvals';
import { eq, lte, sql, and, inArray } from 'drizzle-orm';
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

	const todayReport = await db
		.select({
			id: reports.id,
			bookedAppointments: reports.bookedAppointments,
			productsSold: reports.productsSold,
			serviceRendered: reports.servicesRendered,
			dailyExpenses: reports.dailyExpenses,
			staffPaid: reports.staffPaid,
			dailyIncome: reports.dailyIncome,
			transactions: reports.transactions
		})
		.from(reports)
		.where(eq(reports.reportDate, sql`CURDATE()`))
		.then((rows) => rows[0]);

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
