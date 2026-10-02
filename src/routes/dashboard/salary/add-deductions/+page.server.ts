import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/**
 * The old month-by-month deductions page. It is now one ledger over any period
 * (`/dashboard/salary/ledger/deductions`); this keeps the old link and its bookmarks working.
 */
export const load: PageServerLoad = async () => {
	redirect(308, '/dashboard/salary/ledger/deductions');
};
