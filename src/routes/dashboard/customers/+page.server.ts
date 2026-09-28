import { eq, and } from 'drizzle-orm';

import { db } from '$lib/server/db';
import { customers, user } from '$lib/server/db/schema';
import { isApproved } from '$lib/server/approvals';
import { notDeleted } from '$lib/server/softDelete';
import { daysBetween, isoDate, today } from '$lib/server/db/dialect';
import type { PageServerLoad } from './$types';

/** The payers — employers and insurers — that are approved and active. */
export const load: PageServerLoad = async () => {
	const customerList = await db
		.select({
			id: customers.id,
			name: customers.name,
			phone: customers.phone,
			email: customers.email,
			tinNo: customers.tinNo,
			joinedOn: isoDate(customers.createdAt),
			daysSinceJoined: daysBetween(today(), customers.createdAt),
			addedBy: user.name,
			addedById: user.id
		})
		.from(customers)
		// Attribution: a deleted user still added the payer (CLAUDE.md §9).
		.leftJoin(user, eq(customers.createdBy, user.id))
		// A payer waiting for approval is in the approvals queue, not here.
		.where(and(eq(customers.isActive, true), notDeleted(customers), isApproved(customers)));

	return { customerList };
};
