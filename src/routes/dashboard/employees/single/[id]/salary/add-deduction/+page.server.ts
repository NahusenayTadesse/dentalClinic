import { redirect } from '@sveltejs/kit';
import { ledgerHref } from '$lib/payrollLedger';
import type { PageServerLoad } from './$types';

/**
 * Recording a deduction for one employee happens on the deductions ledger, opened on that employee.
 *
 * This page wrote the row itself — without the audit row every pay adjustment carries, and without
 * the check that refuses an entry inside a period already paid (`payrollLedgerWrites.ts`). It now
 * hands over to the ledger, so old links and bookmarks still land somewhere that works.
 */
export const load: PageServerLoad = ({ params }) => {
	redirect(308, `${ledgerHref('deductions')}?staffId=${encodeURIComponent(params.id)}`);
};
