import { currentQuery, pagination, parseTableQuery } from '$lib/server/queryFilters';
import { PAYSLIP_FILTERS, PAYSLIP_SORTS, payslipPage } from '$lib/server/payslips';
import { db } from '$lib/server/db';
import { employee } from '$lib/server/db/schema';
import { employeeLegalName } from '$lib/server/employeeName';
import { eq } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

/**
 * Paid salaries: every payslip over any period, filtered and totalled on the server
 * (`server/payslips.ts`). It used to redirect to the current month's run page, which made the
 * history readable one month at a time; a month is now a facet, and its row links to that run.
 */
export const load: PageServerLoad = async ({ url, locals }) => {
	const query = parseTableQuery(url, PAYSLIP_FILTERS, 25, PAYSLIP_SORTS);
	const page = await payslipPage(query, locals.branch);
	// Narrowed to one employee from a link (their salary history): say whose, so it can be undone.
	const staffId = Number(query.filters.staffId) || null;
	const forEmployee = staffId
		? await db
				.select({ name: employeeLegalName })
				.from(employee)
				.where(eq(employee.id, staffId))
				.then(([row]) => row?.name ?? null)
		: null;
	return {
		...page,
		forEmployee,
		pagination: pagination(query, page.totals.payslips),
		currentQuery: currentQuery(query)
	};
};
