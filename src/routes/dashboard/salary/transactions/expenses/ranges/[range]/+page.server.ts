import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/**
 * The old copy of the expenses list for one date range (`YYYY-MM-DD-YYYY-MM-DD`). The list itself
 * now filters by any range, so this only carries an old link's range into its date filter.
 */
export const load: PageServerLoad = async ({ params }) => {
	const [y1, m1, d1, y2, m2, d2] = params.range.split('-');
	const query = y2 ? `?dateStart=${y1}-${m1}-${d1}&dateEnd=${y2}-${m2}-${d2}` : '';
	redirect(308, `/dashboard/salary/transactions/expenses${query}`);
};
