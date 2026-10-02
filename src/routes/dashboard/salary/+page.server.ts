import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/** The Salary section has no page of its own; it opens on Paid Salaries. */
export const load: PageServerLoad = () => {
	redirect(302, '/dashboard/salary/paid-salaries');
};
