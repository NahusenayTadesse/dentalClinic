import { superValidate, message } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { z } from 'zod/v4';
import { and, asc, eq } from 'drizzle-orm';
import { notDeleted } from '$lib/server/softDelete';

import { db } from '$lib/server/db';
import { annualLeaveEntitlement } from '$lib/server/db/schema/';
import { getExpiryPolicy, previewAccrual, previewExpiry } from '$lib/server/leaveAccrual';
import { BACKSTOP_AFTER_HOURS, lastLeaveJobRun, runLeaveJob } from '$lib/server/leaveJob';
import type { Actions } from './$types';
import type { PageServerLoad } from './$types.js';

// The runs take no input — the button is the whole form — but superForm still wants a schema.
const run = z.object({});

export const load: PageServerLoad = async () => {
	const form = await superValidate(zod4(run));

	const [policy, brackets, accrual, expiries, lastRun] = await Promise.all([
		getExpiryPolicy(),
		db
			.select({
				fromYears: annualLeaveEntitlement.fromYears,
				toYears: annualLeaveEntitlement.toYears,
				days: annualLeaveEntitlement.days
			})
			.from(annualLeaveEntitlement)
			.where(and(eq(annualLeaveEntitlement.status, true), notDeleted(annualLeaveEntitlement)))
			.orderBy(asc(annualLeaveEntitlement.fromYears)),
		previewAccrual(),
		previewExpiry(),
		lastLeaveJobRun()
	]);

	return {
		form,
		policy,
		brackets,
		pendingGrants: accrual.grants,
		skipped: accrual.skipped,
		pendingExpiries: expiries,
		lastRun,
		backstopAfterHours: BACKSTOP_AFTER_HOURS
	};
};

export const actions: Actions = {
	// Runs the same job the cron calls, so a manual run is recorded alongside the scheduled ones
	// and resets the backstop clock exactly the way a cron run would.
	run: async ({ request, locals }) => {
		const form = await superValidate(request, zod4(run));

		try {
			const result = await runLeaveJob('manual', locals?.user?.id);

			if (result.granted === 0 && result.expired === 0) {
				return message(form, {
					type: 'success',
					text: 'Nothing to do — everyone is up to date and no grants are stale'
				});
			}

			return message(form, { type: 'success', text: result.summary });
		} catch (err: any) {
			return message(form, { type: 'error', text: `Leave job failed: ${err.message}` });
		}
	}
};
