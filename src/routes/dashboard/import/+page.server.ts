import type { RequestEvent } from '@sveltejs/kit';
import { superValidate, message } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import type { FormMessage } from '@nahu/admin-kit/forms/createForm.js';
import { hasPermission, requirePermission } from '$lib/server/permissions';
import { SpreadsheetRefused } from '$lib/server/spreadsheet';
import {
	IMPORT_KINDS,
	IMPORT_LISTS,
	countOf,
	isImportKind,
	type ImportReport
} from '$lib/dataImport';
import { IMPORTERS } from './importers/index.server';
import { checkSheet, writeRows } from './importers/run.server';
import { importSheet, type ImportSheet } from './schema';
import type { Actions, PageServerLoad } from './$types';

/**
 * Importing lists from a spreadsheet.
 *
 * Two gates, as CLAUDE.md §9 asks of an action that does more than its page: the route's
 * `data.import`, which says someone may bring files in at all, and each list's own permission —
 * importing a thousand patients is registering a thousand patients, so it takes
 * `patients.register` too. A list the viewer cannot add by hand is not offered, and the actions
 * refuse it regardless of what is posted.
 */

/** The form's message carries the report the screen draws. */
export type ImportMessage = FormMessage & { report?: ImportReport };

export const load: PageServerLoad = async ({ url, locals }) => {
	const kinds = IMPORT_KINDS.filter((kind) => hasPermission(locals, IMPORTERS[kind].permission));
	const asked = url.searchParams.get('kind');
	const kind = isImportKind(asked) && kinds.includes(asked) ? asked : (kinds[0] ?? null);

	return {
		kinds,
		kind,
		// Records are filed at the branch being worked at; "all branches" is not one (§15).
		branchChosen: locals.branch.active !== null,
		form: await superValidate<ImportSheet, ImportMessage>(
			{ kind: kind ?? IMPORT_KINDS[0] },
			zod4(importSheet),
			{ errors: false }
		)
	};
};

/** One summary line for the toast: what is ready, and what is not. */
function summary(report: ImportReport): string {
	const parts = [`${countOf(report.kind, report.ready)} ready to import`];
	if (report.problemRows) parts.push(`${report.problemRows} with problems`);
	if (report.duplicateRows && !report.includeDuplicates) {
		parts.push(`${report.duplicateRows} possibly here already`);
	}
	return `${parts.join(', ')}.`;
}

/** Checks the file, and when `write` is set imports what passed. */
async function run(event: RequestEvent, write: boolean) {
	const form = await superValidate<ImportSheet, ImportMessage>(event.request, zod4(importSheet));
	if (!form.valid) {
		return message(form, { type: 'error', text: 'Please check the form.' }, { status: 400 });
	}

	const importer = IMPORTERS[form.data.kind];
	const list = IMPORT_LISTS[form.data.kind];
	requirePermission(event.locals, importer.permission);

	if (list.needsBranch && event.locals.branch.active === null) {
		return message(
			form,
			{
				type: 'error',
				text: `Pick a branch in the top bar first — imported ${list.many} are filed at the branch you are working at.`
			},
			{ status: 400 }
		);
	}

	let checked;
	try {
		checked = await checkSheet(importer, form.data.file, {
			calendar: form.data.calendar || 'gregorian',
			includeDuplicates: form.data.includeDuplicates
		});
	} catch (err: unknown) {
		if (err instanceof SpreadsheetRefused) {
			return message(form, { type: 'error', text: err.message }, { status: 400 });
		}
		throw err;
	}

	const { report, ready } = checked;
	if (!write || !ready.length) {
		return message(form, {
			type: ready.length ? 'success' : 'error',
			text: summary(report),
			report
		});
	}

	try {
		const ids = await writeRows(importer, ready, event);
		return message(form, {
			type: 'success',
			text: `${countOf(list.kind, ids.length)} imported.`,
			report: { ...report, imported: ids.length }
		});
	} catch (err: unknown) {
		// Loud in the log, quiet to the client (§9). The transaction means nothing was kept.
		console.error(`[import] writing ${list.many} failed:`, err);
		return message(
			form,
			{
				type: 'error',
				text: 'The import failed and nothing was saved. Check the file again, then import.',
				report
			},
			{ status: 500 }
		);
	}
}

export const actions: Actions = {
	check: (event) => run(event, false),
	import: (event) => run(event, true)
};
