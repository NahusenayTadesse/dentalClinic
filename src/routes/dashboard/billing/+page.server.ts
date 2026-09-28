import { and, count, eq, sql } from 'drizzle-orm';

import { db } from '$lib/server/db';
import { invoice } from '$lib/server/db/schema';
import { notDeleted } from '$lib/server/softDelete';
import { branchFilter } from '$lib/server/branchScope';
import { payerReceivables, receivables } from '$lib/server/billing';
import { hasPermission } from '$lib/server/permissions';
import type { PageServerLoad } from './$types';

/**
 * Billing at this branch: who owes what, the most owed first — patients, and separately the
 * employers and insurers whose bills they are — and how many bills are waiting for a manager. Gated by `billing.invoice` (`routeRules`). Bills themselves are
 * raised and paid on each patient's Billing tab; this is the view across patients.
 */
export const load: PageServerLoad = async ({ locals }) => {
	const [owing, payers, [waiting]] = await Promise.all([
		receivables(locals.branch),
		payerReceivables(locals.branch),
		db
			.select({ total: count() })
			.from(invoice)
			.where(
				and(
					eq(invoice.approvalStatus, 'pending'),
					sql`${invoice.status} <> 'draft'`,
					notDeleted(invoice),
					branchFilter(invoice.branchId, locals.branch)
				)
			)
	]);
	return {
		owing,
		payers,
		totalOwed: [...owing, ...payers].reduce((sum, r) => sum + r.owed, 0),
		awaitingManager: Number(waiting?.total ?? 0),
		canCount: hasPermission(locals, 'billing.cash_session'),
		canApprove: hasPermission(locals, 'approvals.approve')
	};
};
