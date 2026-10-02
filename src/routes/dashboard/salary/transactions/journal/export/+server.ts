import { error } from '@sveltejs/kit';

import { requirePermission } from '$lib/server/permissions';
import { journalFor } from '$lib/server/accountingExport';
import { periodFromUrl } from '$lib/ethiopianMonth';
import { journalCsv, peachtreeCsv } from '$lib/journal';
import type { RequestHandler } from './$types';

/**
 * The month's journal as a file: `?format=peachtree` for Sage 50's General Journal import, or a
 * plain journal for any other ledger. Refused while an account is unmapped or an entry does not
 * balance — a file that posts to `UNMAPPED` is one an accountant has to clean up by hand.
 */
export const GET: RequestHandler = async ({ url, locals }) => {
	requirePermission(locals, 'transactions.manage');
	const period = periodFromUrl(url, 'last');
	const journal = await journalFor(locals.branch, period);
	if (journal.unmapped.length)
		error(409, `Give these an account code first: ${journal.unmapped.join(', ')}.`);
	if (journal.unbalanced) error(409, 'An entry does not balance; nothing was exported.');

	const peachtree = url.searchParams.get('format') === 'peachtree';
	const body = peachtree ? peachtreeCsv(journal.entries) : journalCsv(journal.entries);
	const name = `journal-${period.start}-${period.end}${peachtree ? '-peachtree' : ''}.csv`;
	return new Response(body, {
		headers: {
			'Content-Type': 'text/csv; charset=utf-8',
			'Content-Disposition': `attachment; filename="${name}"`,
			'Cache-Control': 'private, no-store'
		}
	});
};
