import { error } from '@sveltejs/kit';
import { isImportKind } from '$lib/dataImport';
import { requirePermission } from '$lib/server/permissions';
import { IMPORTERS } from '../importers/index.server';
import { templateFor } from '../importers/template.server';
import type { RequestHandler } from './$types';

/**
 * A list's template, `?kind=patients&format=xlsx` (or `csv`).
 *
 * Behind the list's own permission as well as the import page's: the Excel template lists this
 * clinic's payers, departments and positions by name, and those are for the people who may add the
 * records they belong on.
 */
export const GET: RequestHandler = async ({ url, locals }) => {
	const kind = url.searchParams.get('kind');
	if (!isImportKind(kind)) error(404, 'There is no such list to import.');

	const importer = IMPORTERS[kind];
	requirePermission(locals, importer.permission);

	const file = await templateFor(
		importer,
		url.searchParams.get('format') === 'csv' ? 'csv' : 'xlsx'
	);
	return new Response(file.body, {
		headers: {
			'content-type': file.type,
			'content-disposition': `attachment; filename="${file.name}"`,
			// The Lists sheet is this clinic's lists today; a cached copy would offer yesterday's.
			'cache-control': 'no-store'
		}
	});
};
