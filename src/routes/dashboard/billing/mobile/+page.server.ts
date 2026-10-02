import { fail } from '@sveltejs/kit';

import { db } from '$lib/server/db';
import { hasPermission, requirePermission } from '$lib/server/permissions';
import { WriteRefused } from '$lib/server/childCrud';
import {
	RECONCILE_PERMISSION,
	setReconciled,
	transferTotals,
	transfersOn
} from '$lib/server/mobileMoney';
import { messagesFor } from '$lib/i18n/messages';
import { addClinicDays, clinicToday, isIsoDate } from '$lib/clinicTime';
import type { Actions, PageServerLoad } from './$types';

/**
 * One day's transfers at the working branch, to tick against the provider's statement
 * (`server/mobileMoney.ts`). Today by default; `?date=YYYY-MM-DD` picks another day.
 *
 * Reading it is the billing gate (`billing.invoice`); ticking is `billing.cash_session`, checked in
 * the action — the same person who counts the drawer counts this.
 */
export const load: PageServerLoad = async ({ url, locals }) => {
	const today = clinicToday();
	const asked = url.searchParams.get('date');
	const day = isIsoDate(asked) ? asked : today;
	const rows = await transfersOn(locals.branch, day);
	return {
		day,
		today,
		previousDay: addClinicDays(day, -1),
		nextDay: addClinicDays(day, 1),
		rows,
		totals: transferTotals(rows),
		canCheck: hasPermission(locals, RECONCILE_PERMISSION)
	};
};

export const actions: Actions = {
	/** Ticks one transfer as found on the statement, or takes the tick off. */
	reconcile: async (event) => {
		requirePermission(event.locals, RECONCILE_PERMISSION);
		const words = messagesFor(event.locals.lang).billing.mobile;
		const body = await event.request.formData();
		const id = Number(body.get('transactionId'));
		const found = body.get('found') === 'true';
		if (!Number.isInteger(id) || id <= 0) {
			return fail(400, { message: { type: 'error', text: words.notHere } });
		}
		try {
			await db.transaction((tx) => setReconciled(tx, event, id, found, words));
		} catch (err: unknown) {
			if (err instanceof WriteRefused) {
				return fail(400, { message: { type: 'error', text: err.message } });
			}
			throw err;
		}
		return { message: { type: 'success', text: found ? words.marked : words.unmarked } };
	}
};
