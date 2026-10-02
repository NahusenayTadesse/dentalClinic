import { error } from '@sveltejs/kit';
import { cycleDetail } from '$lib/server/sterilisation';
import type { PageServerLoad } from './$types';

/**
 * A cycle's pack labels on paper, to cut out and stick on each pouch. Rendered outside the
 * dashboard layout (`+page@.svelte`); the gate is still `/dashboard/sterilisation`'s.
 */
export const load: PageServerLoad = async ({ params, locals }) => {
	const detail = await cycleDetail(locals.branch, Number(params.cycleId) || 0);
	if (!detail) error(404, 'That cycle is not in this branch’s log.');
	return detail;
};
