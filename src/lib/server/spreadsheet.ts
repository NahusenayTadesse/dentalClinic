/**
 * Spreadsheets in and out: reading a CSV or Excel file as rows of cells, and writing a template.
 *
 * Two libraries do the format work, by the rule in CLAUDE.md §8 — a file format is exactly the long
 * tail of edge cases an in-house reader gets wrong. An `.xlsx` is a zip of XML parts where a cell's
 * text may be in a shared-strings table, inline, or split into styled runs, and a date is a serial
 * number whose meaning lives in a style elsewhere in the archive. `read-excel-file` and
 * `write-excel-file` handle that and share one small dependency (`fflate`); CSV is `papaparse`,
 * already installed.
 *
 * What this module adds on top:
 *
 *   - **row numbers as Excel shows them**, empty rows included in the count, so "row 14" in a report
 *     is the row the person scrolls to
 *   - **CSV text in whichever encoding Excel saved it.** "CSV UTF-8" is one choice in Excel's Save
 *     As; plain "CSV" writes the Windows code page. Read as UTF-8, that one turns every accented or
 *     curly character into garbage, so a file that is not valid UTF-8 is read as Windows-1252.
 *   - **limits**, refused with a message rather than a timeout (`MAX_SHEET_ROWS`)
 *
 * Non-goals: the old binary `.xls` (refused, with how to fix it — Excel saves `.xlsx` in two
 * clicks, and a reader for the 1997 format is a dependency for a problem the person can solve), and
 * more than one sheet of data: the first sheet is read, which is where the template puts the rows.
 */
import Papa from 'papaparse';
import { readSheet } from 'read-excel-file/node';
import writeXlsxFile, { type SheetData } from 'write-excel-file/node';
import type { Cell } from '$lib/dataImport';

/** The most data rows one file may hold. Beyond it, split the file — a check of 5,000 takes seconds. */
export const MAX_SHEET_ROWS = 5000;

/** A file the reader will not take, with a message for the person who chose it. */
export class SpreadsheetRefused extends Error {}

/** A sheet as read: its headings, and each row with anything in it, by Excel's row number. */
export type SheetRows = {
	headings: string[];
	rows: { row: number; cells: Cell[] }[];
};

/** The file's kind, from its name — the browser's reported type for a CSV varies by machine. */
function formatOf(name: string): 'csv' | 'xlsx' | 'xls' | undefined {
	const extension = name.toLowerCase().split('.').pop();
	return extension === 'csv' || extension === 'xlsx' || extension === 'xls' ? extension : undefined;
}

/** CSV bytes as text: UTF-8 when they are, the Windows code page when they are not. */
function decodeCsv(bytes: Uint8Array): string {
	try {
		return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
	} catch {
		return new TextDecoder('windows-1252').decode(bytes);
	}
}

const isEmpty = (cell: Cell | undefined) =>
	cell === null || cell === undefined || (typeof cell === 'string' && cell.trim() === '');

/**
 * Reads the first sheet of a CSV or `.xlsx` file. The first row with anything in it is the headings;
 * every later row with anything in it is data.
 */
export async function readSpreadsheet(file: File): Promise<SheetRows> {
	const format = formatOf(file.name);
	if (format === 'xls') {
		throw new SpreadsheetRefused(
			'This is an old Excel file (.xls). Open it in Excel, choose Save As, and save it as an Excel Workbook (.xlsx) or as CSV.'
		);
	}
	if (!format) {
		throw new SpreadsheetRefused('Choose an Excel file (.xlsx) or a CSV file.');
	}

	const bytes = new Uint8Array(await file.arrayBuffer());
	let grid: Cell[][];

	if (format === 'csv') {
		// No `skipEmptyLines`: an empty line still counts, or every row number after it is wrong.
		const parsed = Papa.parse<string[]>(decodeCsv(bytes).replace(/^\uFEFF/, ''), {
			skipEmptyLines: false
		});
		grid = parsed.data;
	} else {
		try {
			grid = (await readSheet(Buffer.from(bytes))) as Cell[][];
		} catch (err: unknown) {
			console.error('[spreadsheet] could not read an .xlsx:', err);
			throw new SpreadsheetRefused(
				'This file could not be read as an Excel workbook. Open it in Excel and save it again as .xlsx, or as CSV.'
			);
		}
	}

	const headingIndex = grid.findIndex((row) => row.some((cell) => !isEmpty(cell)));
	if (headingIndex === -1) throw new SpreadsheetRefused('The file is empty.');

	const rows = grid
		.map((cells, index) => ({ row: index + 1, cells }))
		.slice(headingIndex + 1)
		.filter(({ cells }) => cells.some((cell) => !isEmpty(cell)));

	if (rows.length > MAX_SHEET_ROWS) {
		throw new SpreadsheetRefused(
			`The file has ${rows.length.toLocaleString('en-US')} rows; one file may hold ${MAX_SHEET_ROWS.toLocaleString('en-US')}. Split it into smaller files and import them one after another.`
		);
	}

	return {
		headings: grid[headingIndex].map((cell) => (isEmpty(cell) ? '' : String(cell).trim())),
		rows
	};
}

/* ── Templates ─────────────────────────────────────────────────────────────────────────────── */

/** A column of a template: its heading, and whether its cells should be kept as text. */
export type TemplateColumn = { heading: string; text?: boolean; width?: number };

/** A sheet of plain text rows — the instructions and the reference lists. */
export type TextSheet = { name: string; rows: string[][]; widths?: number[] };

/**
 * How many rows of a template are formatted ahead of time. Excel applies a cell's format when
 * something is typed into it, so the text columns are pre-formatted this far down; a file longer
 * than this is pasted from somewhere rather than typed, and `phoneCell` repairs the zeros anyway.
 */
const FORMATTED_ROWS = 1000;

/**
 * An Excel template: a first sheet with the headings, frozen, and the text columns formatted as
 * text so a leading 0 survives; then the sheets that explain it.
 */
export async function xlsxTemplate(
	name: string,
	columns: TemplateColumn[],
	more: TextSheet[]
): Promise<Buffer> {
	const blankRow = columns.map((c) => (c.text ? { type: String, format: '@' } : null));
	const data: SheetData = [
		columns.map((c) => ({ value: c.heading, fontWeight: 'bold' as const })),
		...Array.from({ length: FORMATTED_ROWS }, () => blankRow)
	];

	return writeXlsxFile([
		{
			sheet: name,
			data,
			stickyRowsCount: 1,
			columns: columns.map((c) => ({ width: c.width ?? Math.max(14, c.heading.length + 4) }))
		},
		...more.map((sheet) => ({
			sheet: sheet.name,
			data: sheet.rows.map((row, i) =>
				row.map((value) => (i === 0 ? { value, fontWeight: 'bold' as const } : value))
			),
			stickyRowsCount: 1,
			columns: (sheet.widths ?? []).map((width) => ({ width }))
		}))
	]).toBuffer();
}

/**
 * A CSV template: the headings alone, behind a byte-order mark so Excel opens it as UTF-8 and the
 * curly apostrophe in "Father’s name" — or a name typed in Amharic — reads as written.
 */
export function csvTemplate(columns: TemplateColumn[]): string {
	return `\uFEFF${Papa.unparse([columns.map((c) => c.heading)])}\r\n`;
}
