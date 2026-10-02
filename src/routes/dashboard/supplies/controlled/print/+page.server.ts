import { error } from '@sveltejs/kit';
import { letterheadFor } from '$lib/server/branchScope';
import { clinicToday } from '$lib/clinicTime';
import { registerPage } from '../register.server';
import type { PageServerLoad } from './$types';

/**
 * The register and the month's return on paper, under the branch's letterhead, for the pharmacist
 * and the head of the clinic to sign. Rendered outside the dashboard layout (`+page@.svelte`); the
 * gate is still `/dashboard/supplies`'s. A return is one facility's, so a branch must be chosen.
 */
export const load: PageServerLoad = async ({ url, locals }) => {
	if (locals.branch.active === null)
		error(400, 'Choose a branch in the top bar: each files its own.');
	const [page, branch] = await Promise.all([
		registerPage(url, locals.branch),
		letterheadFor(locals.branch.active)
	]);
	return { ...page, branch, printedOn: clinicToday() };
};
