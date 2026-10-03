/**
 * Running an import: the same steps for every list.
 *
 * **Checking and importing are one path.** The Import button posts the same file again, and it is
 * read, parsed and checked again from the start before anything is written — never trusted from
 * what the check said a minute earlier. The records may have changed since (someone registered a
 * patient at the desk), and a check the client could replay is not a check.
 *
 * **What is imported is what passed, and nothing else.** A row with a problem is left out; a row
 * that looks like a record already here is left out unless the person ticks that they are
 * different. The rest are written in **one transaction**: a failure part-way through leaves none of
 * them, so a second attempt never meets half a file already in.
 *
 * **One audit row per import** for the audited lists, not one per row (AUDIT.md): an import of 400
 * patients is one act by one person, and 400 rows saying "created" would cost the space the rule
 * exists to save while telling nobody more. The rows themselves carry `createdBy`.
 */
import type { RequestEvent } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { recordAudit } from '$lib/server/audit';
import { readSpreadsheet, SpreadsheetRefused } from '$lib/server/spreadsheet';
import {
	REPORT_LIMIT,
	matchHeadings,
	type DateCalendar,
	type ImportProblem,
	type ImportReport
} from '$lib/dataImport';
import { Lists, type Importer, type ReadyRow, type RowCells } from './importer.server';

/** How many ready rows the report previews. */
const PREVIEW_ROWS = 8;

export type RunOptions = { calendar: DateCalendar; includeDuplicates: boolean };

/**
 * Reads and checks a file against a list. Returns the report for the screen and the rows ready to
 * write. Throws `SpreadsheetRefused` for a file that cannot be read as this list at all.
 */
export async function checkSheet<T>(
	importer: Importer<T>,
	file: File,
	options: RunOptions
): Promise<{ report: ImportReport; ready: ReadyRow<T>[] }> {
	const sheet = await readSpreadsheet(file);
	const headings = matchHeadings(sheet.headings, importer.list.columns);

	if (headings.missing.length) {
		const names = headings.missing.map((c) => `“${c.label}”`).join(', ');
		throw new SpreadsheetRefused(
			`The file has no ${names} column. Use the headings in the template — download it above and copy your rows into it.`
		);
	}
	if (!sheet.rows.length) {
		throw new SpreadsheetRefused('The file has headings but no rows under them.');
	}

	const lists = new Lists(await importer.lookups());
	const problems: ImportProblem[] = [];
	const parsed: ReadyRow<T>[] = [];

	for (const { row, cells } of sheet.rows) {
		const byKey: RowCells = new Map();
		headings.columns.forEach((column, i) => {
			if (column) byKey.set(column.key, cells[i] ?? null);
		});

		const result = importer.parse(byKey, { lists, calendar: options.calendar });
		if (result.ok)
			parsed.push({ row, value: result.value, label: result.label, shown: result.shown });
		else problems.push(...result.problems.map((p) => ({ row, ...p })));
	}

	const checked = await importer.check(parsed);
	problems.push(...checked.problems);

	const problemRows = new Set(problems.map((p) => p.row));
	// A row already out for a problem is not also asked about as a duplicate.
	const duplicates = checked.duplicates.filter((d) => !problemRows.has(d.row));
	const duplicateRows = new Set(duplicates.map((d) => d.row));
	const ready = parsed.filter(
		(r) => !problemRows.has(r.row) && (options.includeDuplicates || !duplicateRows.has(r.row))
	);

	problems.sort((a, b) => a.row - b.row);
	duplicates.sort((a, b) => a.row - b.row);

	return {
		ready,
		report: {
			kind: importer.list.kind,
			file: { name: file.name, size: file.size },
			rows: sheet.rows.length,
			ready: ready.length,
			problemRows: problemRows.size,
			problems: problems.slice(0, REPORT_LIMIT),
			problemsHidden: Math.max(0, problems.length - REPORT_LIMIT),
			duplicateRows: duplicateRows.size,
			duplicates: duplicates.slice(0, REPORT_LIMIT),
			includeDuplicates: options.includeDuplicates,
			ignored: [...headings.ignored, ...headings.repeated.map((h) => `${h} (repeated)`)],
			preview: {
				headings: importer.previewHeadings,
				rows: ready.slice(0, PREVIEW_ROWS).map((r) => ({ row: r.row, cells: r.shown }))
			}
		}
	};
}

/**
 * Writes the ready rows in one transaction, with one audit row for the import when the list is
 * audited. Returns the new ids.
 */
export async function writeRows<T>(
	importer: Importer<T>,
	ready: ReadyRow<T>[],
	event: RequestEvent
): Promise<number[]> {
	const { locals } = event;
	const stamp = { userId: locals.user?.id, branchId: locals.branch.active };

	return db.transaction(async (tx) => {
		const ids = await importer.write(
			tx,
			ready.map((r) => r.value),
			stamp
		);

		if (importer.audit && ids.length) {
			await recordAudit(tx, event, {
				table: importer.audit,
				recordId: ids[0],
				action: 'create',
				// The import, not its rows: how many, the last id, and that a file brought them in.
				detail: { imported: ids.length, lastId: ids[ids.length - 1], source: 'spreadsheet' }
			});
		}

		return ids;
	});
}
