import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/**
 * One employee's payslip history. It was a page of its own — a filter menu over every payslip they
 * had, and an unused copy of the employee salary page's "add salary" action. Paid Salaries now
 * lists any employee's payslips over any period, with totals, so this keeps the old address (and
 * the `salary` record link) by sending it there.
 */
export const load: PageServerLoad = async ({ params }) => {
	redirect(308, `/dashboard/salary/paid-salaries?staffId=${encodeURIComponent(params.id)}`);
};
