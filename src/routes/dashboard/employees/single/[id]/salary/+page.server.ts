import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/**
 * An employee's salary: their payslips, on Paid Salaries narrowed to them.
 *
 * This was a form for entering a payslip by hand, and it trusted the browser for the money — the
 * net, the tax and the amount paid were all posted fields, written to a `paid` payroll entry
 * outside any payroll run. Pay is computed on the server, in the run (`payrollMath.ts`); this page
 * now shows what was paid instead of letting it be typed in.
 */
export const load: PageServerLoad = ({ params }) => {
	redirect(308, `/dashboard/salary/paid-salaries?staffId=${encodeURIComponent(params.id)}`);
};
