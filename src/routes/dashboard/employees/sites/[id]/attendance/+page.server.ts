import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { currentEthiopianMonthParam } from '$lib/global.svelte';

export const load: PageServerLoad = async ({ params }) => {
	const { id } = params;
	redirect(303, `/dashboard/employees/sites/${id}/attendance/${currentEthiopianMonthParam()}`);
};
