/**
 * What an importable list is on the server, and the helpers every list's importer reads cells with.
 *
 * An importer has four jobs, in the order a file meets them:
 *
 *   1. **parse** one row's cells into exactly what that list's form would post, and validate it with
 *      the form's own schema — so the rules for a valid patient are registration's rules, word for
 *      word, and cannot drift into a second copy here;
 *   2. **check** the parsed rows against what is already stored and against each other — a TIN
 *      already registered is a problem that keeps the row out, a patient with the same name and
 *      phone is a possible duplicate the person decides about;
 *   3. **write** the rows that pass, through the same function the form's action calls;
 *   4. say what it is for the screen — the list's columns and words live in `$lib/dataImport.ts`.
 *
 * The orchestration — reading the file, lining up headings, deciding what is ready — is
 * `run.server.ts`, the same for every list.
 */
import type { z } from 'zod';
import type { db } from '$lib/server/db';
import type { AuditedTable } from '$lib/server/audit';
import type { WriteStamp } from '$lib/server/patientWrites';
import {
	LIST_NAMES,
	cellText,
	lookupKey,
	type Cell,
	type CellResult,
	type DateCalendar,
	type ImportList,
	type ImportListName,
	type ImportMatch,
	type ImportProblem
} from '$lib/dataImport';
import { formatEthiopianDate } from '$lib/global.svelte';

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** A row of a reference list: its id, its name, and any other way it may be written (a TIN). */
export type Lookup = { value: number; name: string; also?: string[]; departmentId?: number | null };

/** The reference lists a file is read against, by name. */
export type Lookups = Partial<Record<ImportListName, Lookup[]>>;

/** One data row's cells, by column key. A column the file does not have is absent. */
export type RowCells = Map<string, Cell>;

/** A problem with a row, before it has a row number. `column` is the heading the person sees. */
export type RowProblem = { column?: string; message: string };

/** A row that passed: the form's input, who it is, and how the preview shows it. */
export type Parsed<T> =
	{ ok: true; value: T; label: string; shown: string[] } | { ok: false; problems: RowProblem[] };

/** A parsed row with its spreadsheet row number. */
export type ReadyRow<T> = { row: number; value: T; label: string; shown: string[] };

export type ParseContext = { lists: Lists; calendar: DateCalendar };

export type Importer<T> = {
	list: ImportList;
	/** The permission adding one of these by hand takes. Importing takes it too (CLAUDE.md §9). */
	permission: string;
	/** The table an import is recorded against in the audit log, when the list is audited. */
	audit?: AuditedTable;
	lookups(): Promise<Lookups>;
	/** The preview's headings, matching what `parse` puts in `shown`. */
	previewHeadings: string[];
	parse(cells: RowCells, context: ParseContext): Parsed<T>;
	check(rows: ReadyRow<T>[]): Promise<{ problems: ImportProblem[]; duplicates: ImportMatch[] }>;
	/** Writes the rows in the caller's transaction. Returns the new ids, in order. */
	write(tx: Tx, rows: T[], stamp: WriteStamp): Promise<number[]>;
};

/* ── Reference lists ───────────────────────────────────────────────────────────────────────── */

/**
 * The reference lists, indexed by `lookupKey` so a file of five thousand rows does not search a
 * list five thousand times.
 */
export class Lists {
	private index = new Map<ImportListName, Map<string, Lookup[]>>();

	constructor(private lookups: Lookups) {
		for (const [name, rows] of Object.entries(lookups) as [ImportListName, Lookup[]][]) {
			const byKey = new Map<string, Lookup[]>();
			for (const row of rows) {
				for (const spelling of [row.name, ...(row.also ?? [])]) {
					const key = lookupKey(spelling);
					byKey.set(key, [...(byKey.get(key) ?? []), row]);
				}
			}
			this.index.set(name, byKey);
		}
	}

	/** Every row of `list` the text names. More than one only where names repeat — positions. */
	all(list: ImportListName, text: string): Lookup[] {
		return this.index.get(list)?.get(lookupKey(text)) ?? [];
	}

	/**
	 * The row `text` names in `list`: `undefined` for an empty cell, and a problem — saying where the
	 * list is kept — for a name that is not on it.
	 */
	find(list: ImportListName, text: string): CellResult<Lookup | undefined> {
		if (!text) return { ok: true, value: undefined };
		const [found] = this.all(list, text);
		return found ? { ok: true, value: found } : { ok: false, message: notListed(list, text) };
	}

	/** The names in a list, for the template. */
	names(list: ImportListName): string[] {
		return (this.lookups[list] ?? []).map((row) => row.name);
	}
}

/** What to say about a name that is not on its list. */
export function notListed(list: ImportListName, text: string): string {
	const { title, where } = LIST_NAMES[list];
	return `“${text}” is not in ${title}. Check the spelling, or add it under ${where} first.`;
}

/* ── Reading a row ─────────────────────────────────────────────────────────────────────────── */

/**
 * Gathers a row's problems, one per column: the first thing wrong with a cell is what the person
 * fixes, and a second message about the same cell — the schema's "required" after the reader's
 * "not a date" — only says it again in other words.
 */
export class Problems {
	private byColumn = new Map<string, string>();
	private general: string[] = [];

	constructor(private list: ImportList) {}

	/** The heading a field's problem is reported under. `field` may be a column key or a form field. */
	private heading(field: string | undefined): string | undefined {
		return field ? this.list.columns.find((c) => c.key === field)?.label : undefined;
	}

	add(field: string | undefined, message: string) {
		const heading = this.heading(field);
		if (!heading) this.general.push(message);
		else if (!this.byColumn.has(heading)) this.byColumn.set(heading, message);
	}

	/** Takes a cell result's message, if it has one, and returns its value either way. */
	take<T>(field: string, result: CellResult<T>, fallback: T): T {
		if (result.ok) return result.value;
		this.add(field, result.message);
		return fallback;
	}

	/**
	 * The form schema's complaints, each under the column it came from. `columnOf` names the column
	 * for a form field spelled differently — `customerId` is the Payer column.
	 */
	addSchema(error: z.ZodError, columnOf: Record<string, string> = {}) {
		for (const issue of error.issues) {
			const field = typeof issue.path[0] === 'string' ? issue.path[0] : undefined;
			this.add(field ? (columnOf[field] ?? field) : undefined, issue.message);
		}
	}

	/** Required columns left empty — said plainly, before the schema says it its own way. */
	requireFilled(cells: RowCells) {
		for (const column of this.list.columns) {
			if (column.required && cellText(cells.get(column.key)) === '') {
				this.add(column.key, `${column.label} is empty`);
			}
		}
	}

	get any(): boolean {
		return this.byColumn.size > 0 || this.general.length > 0;
	}

	get all(): RowProblem[] {
		return [
			...[...this.byColumn].map(([column, message]) => ({ column, message })),
			...this.general.map((message) => ({ message }))
		];
	}
}

/**
 * Whether a TIN cell is a number Excel has taken leading zeros off. An Ethiopian TIN is ten digits
 * and may start with 0; typed into a cell Excel thinks is numeric, "0012345678" becomes 12345678,
 * and the schema's "must be exactly 10 digits" would leave the person looking for a typo that is
 * not there.
 */
export function tinLostZeros(cell: Cell | undefined): boolean {
	return typeof cell === 'number' && String(cell).length < 10;
}

/** What to say when it has. */
export const TIN_LOST_ZEROS =
	'Excel took the leading 0 off this TIN. Format the TIN column as Text, and type the number again.';

/** A form value for an optional text field: `undefined` when empty, as an untouched input posts. */
export const optional = (text: string) => (text === '' ? undefined : text);

/** A Gregorian day as the preview shows it: the Ethiopian date, then the day as stored. */
export function shownDay(iso: string | undefined | null): string {
	return iso ? `${formatEthiopianDate(new Date(`${iso}T12:00:00Z`))} (${iso})` : '';
}

/* ── Checking rows against each other ──────────────────────────────────────────────────────── */

/**
 * Finds rows of a file that repeat an earlier row by some key — the same TIN twice, the same name
 * and phone twice. Returns, for each later row, the earlier row it repeats.
 */
export function repeatsWithin<T>(
	rows: ReadyRow<T>[],
	keyOf: (value: T) => string | undefined
): Map<number, number> {
	const first = new Map<string, number>();
	const repeats = new Map<number, number>();
	for (const { row, value } of rows) {
		const key = keyOf(value);
		if (!key) continue;
		const earlier = first.get(key);
		if (earlier === undefined) first.set(key, row);
		else repeats.set(row, earlier);
	}
	return repeats;
}
