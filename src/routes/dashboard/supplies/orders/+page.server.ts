import { superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';

import { formAction } from '$lib/server/patientAction';
import { PURCHASING_PERMISSION, draftOrder, orderList } from '$lib/server/purchasing';
import { suppliers } from '$lib/server/fastData';
import { newOrder } from './schema';
import type { Actions, PageServerLoad } from './$types';

/**
 * Purchase orders at the branch being worked at: every order with what has arrived and what has
 * been invoiced, and starting a new one. Gated with the rest of `/dashboard/supplies`; each action
 * asks again (CLAUDE.md §9).
 */
export const load: PageServerLoad = async ({ locals }) => {
	const [orders, supplierList, form] = await Promise.all([
		orderList(locals.branch),
		suppliers(),
		superValidate(zod4(newOrder))
	]);
	return {
		orders,
		suppliers: supplierList.map((s) => ({ value: String(s.value), name: s.name })),
		form,
		branchChosen: locals.branch.active !== null
	};
};

export const actions: Actions = {
	draft: (event) =>
		formAction(event, PURCHASING_PERMISSION, newOrder, async (data) => async (tx) => {
			const id = await draftOrder(tx, event, Number(data.supplierId));
			return {
				redirect: `/dashboard/supplies/orders/${id}`,
				text: 'Draft started. Add what to order.'
			};
		})
};
