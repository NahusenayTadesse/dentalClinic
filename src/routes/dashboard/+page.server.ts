import { auth } from '$lib/server/auth';
import { fail } from '@sveltejs/kit';
import { redirect } from 'sveltekit-flash-message/server';

import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { reports, supplies, siteContracts, services, site } from '$lib/server/db/schema';
import { isApproved } from '$lib/server/approvals';
import { eq, lte, sql, and, inArray } from 'drizzle-orm';
import { notDeleted } from '$lib/server/softDelete';
export const load: PageServerLoad = async ({ locals }) => {
	const reorderSupplies = await db
		.select({
			name: supplies.name,
			quantity: supplies.quantity
		})
		.from(supplies)
		.where(and(lte(supplies.quantity, supplies.reorderLevel), notDeleted(supplies)));

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

	const expiringContracts = await db
		.select({
			id: siteContracts.id,
			service: services.name,
			site: site.name,
			endDate: siteContracts.endDate,
			// We re-calculate this here for use in the UI
			daysRemaining: sql<number>`DATEDIFF(${siteContracts.endDate}, NOW())`,
			monthlyAmount: siteContracts.monthlyAmount,
			status: siteContracts.isActive
		})
		.from(siteContracts)
		.leftJoin(services, and(eq(siteContracts.serviceId, services.id), notDeleted(services)))
		.leftJoin(site, and(eq(siteContracts.siteId, site.id), notDeleted(site)))
		.where(
			and(
				eq(siteContracts.isActive, true),
				notDeleted(siteContracts),
				// A contract still awaiting approval is not in force, so it is neither chased for
				// renewal nor auto-expired.
				isApproved(siteContracts),
				sql`DATEDIFF(${siteContracts.endDate}, NOW()) < 30`
			)
		)
		.orderBy(sql`DATEDIFF(${siteContracts.endDate}, NOW()) ASC`);

	await db
		.update(siteContracts)
		.set({ isActive: false, inActiveReason: 'Automatic Expiration of Contract By System' })
		.where(
			inArray(
				siteContracts.id,
				expiringContracts.filter((c) => c.daysRemaining <= 0).map((c) => c.id)
			)
		);

	return {
		reorderSupplies,
		todayReport,
		expiringContracts
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
