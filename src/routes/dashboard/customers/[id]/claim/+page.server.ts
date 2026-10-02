import { error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';

import { db } from '$lib/server/db';
import { customers } from '$lib/server/db/schema';
import { letterheadFor } from '$lib/server/branchScope';
import { requirePermission } from '$lib/server/permissions';
import { payerClaim } from '$lib/server/payerCover';
import { readSettings } from '$lib/server/settings';
import { ethiopianRange, getMonthNumber } from '$lib/global.svelte';
import { clinicToday } from '$lib/clinicTime';
import type { PageServerLoad } from './$types';

/**
 * A payer's claim for one Ethiopian month, on paper: every bill billed to them in it, with member
 * numbers and pre-authorisation references, what each came to and what is still owed. Outside the
 * dashboard layout (`+page@.svelte`) so it prints as a page; money, so `billing.invoice` as well as
 * the payer page's own gate. `?month=<month name>_<year>`.
 */
export const load: PageServerLoad = async ({ params, url, locals }) => {
	requirePermission(locals, 'billing.invoice');
	const customerId = Number(params.id);
	const [name, y] = (url.searchParams.get('month') ?? '').split('_');
	const month = getMonthNumber(name ?? '');
	const year = Number(y);
	if (!Number.isInteger(customerId) || month < 1 || !Number.isInteger(year)) {
		error(400, 'Choose the month to claim for.');
	}

	const [[payer], settings, letterhead] = await Promise.all([
		db
			.select({ name: customers.name, tin: customers.tinNo, phone: customers.phone })
			.from(customers)
			.where(eq(customers.id, customerId))
			.limit(1),
		readSettings(),
		letterheadFor(locals.branch.active)
	]);
	if (!payer) error(404, 'That payer no longer exists.');

	const period = ethiopianRange(month, year);
	const bills = await payerClaim(customerId, period);
	return {
		payer,
		clinicTin: settings.tin,
		branch: letterhead,
		monthName: name,
		year,
		period,
		bills,
		printedOn: clinicToday()
	};
};
