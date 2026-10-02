import { superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';

import { formAction } from '$lib/server/patientAction';
import { accountTargets, journalFor, saveAccountCodes } from '$lib/server/accountingExport';
import { formatEthiopianYearMonth } from '$lib/global.svelte';
import { periodFromUrl } from '$lib/ethiopianMonth';
import { accountCodes } from './schema';
import type { Actions, PageServerLoad } from './$types';

/** Who may export the books and set their account codes: whoever keeps the transactions. */
const PERMISSION = 'transactions.manage';

/**
 * The accounting export: a month of the clinic's money as journal entries for the accountant's
 * ledger, and the account codes they post to. The month defaults to the last one that has ended —
 * the books are closed after it.
 */
export const load: PageServerLoad = async ({ url, locals }) => {
	const period = periodFromUrl(url, 'last');
	const month = decodeURIComponent(formatEthiopianYearMonth(period.year, period.month));
	const [journal, targets] = await Promise.all([
		journalFor(locals.branch, period),
		accountTargets()
	]);
	const form = await superValidate(
		{ codes: targets.map((t) => ({ target: t.target, code: t.code })) },
		zod4(accountCodes),
		{ errors: false }
	);
	const debits = journal.entries.reduce(
		(sum, e) => sum + e.lines.reduce((s, l) => s + l.debit, 0),
		0
	);
	return {
		month,
		period,
		count: journal.entries.length,
		debits: Math.round(debits * 100) / 100,
		preview: journal.entries.slice(0, 40),
		unmapped: journal.unmapped,
		suspense: journal.suspense,
		unbalanced: journal.unbalanced,
		targets,
		form
	};
};

export const actions: Actions = {
	accounts: (event) =>
		formAction(event, PERMISSION, accountCodes, async (data) => async (tx) => {
			const n = await saveAccountCodes(tx, event.locals.user?.id, data.codes);
			return n ? `Saved ${n} account code${n === 1 ? '' : 's'}.` : 'Nothing changed.';
		})
};
