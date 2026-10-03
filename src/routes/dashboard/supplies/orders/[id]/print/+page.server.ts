import { error } from '@sveltejs/kit';
import { orderDetail } from '$lib/server/purchasing';
import { letterheadFor } from '$lib/server/branchScope';
import type { PageServerLoad } from './$types';

/**
 * A purchase order on paper, for the supplier, under the letterhead of the branch that ordered.
 * Rendered outside the dashboard layout (`+page@.svelte`); the gate is still
 * `/dashboard/supplies`'s. A draft has no number yet, so it does not print.
 */
export const load: PageServerLoad = async ({ params, locals }) => {
	const detail = await orderDetail(locals.branch, Number(params.id) || 0);
	if (!detail) error(404, 'That order is not in this branch’s list.');
	if (detail.order.status === 'draft') error(409, 'Send the order first: a draft has no number.');
	return { ...detail, branch: await letterheadFor(detail.order.branchId) };
};
