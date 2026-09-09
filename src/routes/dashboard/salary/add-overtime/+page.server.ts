import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { currentEthiopianMonthParam } from '$lib/global.svelte';

export const load: PageServerLoad = async () => {
	redirect(303, `/dashboard/salary/add-overtime/${currentEthiopianMonthParam()}`);
};
