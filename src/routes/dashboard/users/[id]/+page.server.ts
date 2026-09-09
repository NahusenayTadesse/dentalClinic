import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	let { id } = params;

	redirect(302, `/dashboard/admin-panel/users/${id}`);
};
