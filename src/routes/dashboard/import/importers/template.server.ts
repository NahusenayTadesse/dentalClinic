/**
 * A list's template, drawn from its columns — so a column added to `IMPORT_LISTS` is in the next
 * template downloaded, and a template cannot ask for something the import does not read.
 *
 * The Excel template has three sheets: the headings to fill in under (required ones starred, text
 * columns pre-formatted so Excel keeps a leading 0), what each column takes, and the names each
 * reference column must be one of — read from this clinic's own lists at the moment of download,
 * so "Department" offers the departments that exist rather than an example nobody has.
 *
 * The CSV template is the headings alone; a CSV has no second sheet to explain itself on.
 */
import { LIST_NAMES, type ImportListName } from '$lib/dataImport';
import { csvTemplate, xlsxTemplate, type TemplateColumn } from '$lib/server/spreadsheet';
import { Lists, type Importer } from './importer.server';

export type TemplateFile = { body: Uint8Array<ArrayBuffer> | string; type: string; name: string };

/** The template's headings: the column labels, with a star on the required ones. */
function headingsOf(importer: Importer<unknown>): TemplateColumn[] {
	return importer.list.columns.map((c) => ({
		heading: c.required ? `${c.label} *` : c.label,
		text: c.text
	}));
}

export async function templateFor(
	importer: Importer<unknown>,
	format: 'xlsx' | 'csv'
): Promise<TemplateFile> {
	const { list } = importer;
	const columns = headingsOf(importer);

	if (format === 'csv') {
		return {
			body: csvTemplate(columns),
			type: 'text/csv; charset=utf-8',
			name: `${list.kind}.csv`
		};
	}

	const lists = new Lists(await importer.lookups());
	const used = [
		...new Set(list.columns.flatMap((c) => (c.list ? [c.list] : [])))
	] as ImportListName[];

	const guide = [
		['Column', 'Required', 'What to write'],
		...list.columns.map((c) => [
			c.label,
			c.required ? 'Yes' : '',
			c.list
				? `${c.hint}. The names allowed are under “${LIST_NAMES[c.list].title}” on the Lists sheet.`
				: c.hint
		]),
		[],
		['How it works'],
		[
			`One row per ${list.one}, under the headings on the first sheet. Keep the headings as they are.`
		],
		[
			'Dates: the import screen asks whether they are written in the Ethiopian or the Gregorian calendar.'
		],
		[
			'Every row is checked before anything is saved. Rows with a problem are left out and listed by row number.'
		],
		[
			'Fix those rows and import the whole file again — the rows already imported are recognised and left out.'
		],
		...(list.approval ? [[list.approval]] : [])
	];

	const longest = Math.max(1, ...used.map((name) => lists.names(name).length));
	const reference = [
		used.map((name) => LIST_NAMES[name].title),
		...Array.from({ length: longest }, (_, i) => used.map((name) => lists.names(name)[i] ?? ''))
	];

	const body = await xlsxTemplate(list.title, columns, [
		{ name: 'What to write', rows: guide, widths: [24, 10, 90] },
		...(used.length ? [{ name: 'Lists', rows: reference, widths: used.map(() => 28) }] : [])
	]);

	return {
		body: new Uint8Array(body),
		type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
		name: `${list.kind}.xlsx`
	};
}
