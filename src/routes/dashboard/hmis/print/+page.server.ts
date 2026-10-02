import { error } from '@sveltejs/kit';
import { monthlyReturn } from '$lib/server/hmisReport';
import { clinicToday } from '$lib/clinicTime';
import { requestedPeriod } from '../period.server';
import type { PageServerLoad } from './$types';

/**
 * The return on paper, under the facility's letterhead. Rendered outside the dashboard layout
 * (`+page@.svelte`), so it prints as a page; the route gate is still `/dashboard/hmis`'s.
 */
export const load: PageServerLoad = async ({ url, locals }) => {
	const branchId = locals.branch.active;
	if (branchId === null) error(400, 'Choose a branch in the top bar: each facility files its own.');
	const report = await monthlyReturn(branchId, requestedPeriod(url));
	if (!report) error(404, 'That branch no longer exists.');
	return { report, printedOn: clinicToday() };
};
