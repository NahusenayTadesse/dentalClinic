import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from '../$types';
import { currentEthiopianMonthParam } from '$lib/global.svelte';

export const load: PageServerLoad = async () => {
	throw redirect(302, `/dashboard/salary/paid-salaries/${currentEthiopianMonthParam()}`);
};
