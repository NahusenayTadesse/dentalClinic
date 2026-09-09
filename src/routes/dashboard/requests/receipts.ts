/**
 * One invoice document = one receipt, however many months it covers.
 *
 * `payment_request` stores a row per (site, month) — that is what the
 * `unique_payment_per_month` index is keyed on, and what the approve/reject
 * flow acts on. But a *special* request (`/dashboard/requests/special`) asks
 * for several months of the same site on a single invoice: it mints one
 * `invoiceNumber` and writes one row per month under it. Rendering those rows
 * one-per-page produced N near-identical invoices carrying the same invoice
 * number, each showing a single month's total, which is not the document that
 * was sent to the customer.
 *
 * So the pages group back on the way out. `(siteId, invoiceNumber)` is the
 * document key: every write path mints the invoice number per site per submit,
 * so an ordinary request groups to exactly one row and a special one groups to
 * however many months it was raised for. `siteId` is in the key because the
 * generator only guarantees uniqueness within a site.
 */
import { getMonthNumber } from '$lib/global.svelte';

/** The company line printed on every receipt. */
export const COMPANY_PHONE = '0988190000';

/** The columns grouping needs; loads select the whole table plus joins on top. */
export type ReceiptRow = {
	id: number;
	invoiceNumber: string;
	siteId: number;
	month: string;
	year: number;
};

export type ReceiptMonth = { id: number; month: string; year: number };

export type Receipt<T extends ReceiptRow> = {
	/** `siteId::invoiceNumber` — stable across loads, safe as an `{#each}` key. */
	key: string;
	invoiceNumber: string;
	siteId: number;
	/** Every request row on this invoice, oldest month first. */
	rows: T[];
	/** Their ids, for the actions that decide or delete the whole document. */
	ids: number[];
	/** The periods billed, oldest first. */
	months: ReceiptMonth[];
	/** The first row, for the fields that are the same across the whole invoice. */
	head: T;
};

export function receiptKey(row: ReceiptRow): string {
	return `${row.siteId}::${row.invoiceNumber}`;
}

/** Ethiopian year first, then the month's position in the calendar. */
function byPeriod(a: { month: string; year: number }, b: { month: string; year: number }): number {
	return a.year - b.year || getMonthNumber(a.month) - getMonthNumber(b.month);
}

/**
 * Groups request rows into receipts, preserving the order the rows arrived in:
 * the first time a document is seen fixes its place, so the sort the load asked
 * the database for (latest approved, latest rejected, latest requested) carries
 * through to the page.
 */
export function groupReceipts<T extends ReceiptRow>(rows: T[]): Receipt<T>[] {
	const byKey = new Map<string, Receipt<T>>();

	for (const row of rows) {
		const key = receiptKey(row);
		let receipt = byKey.get(key);

		if (!receipt) {
			receipt = {
				key,
				invoiceNumber: row.invoiceNumber,
				siteId: row.siteId,
				rows: [],
				ids: [],
				months: [],
				head: row
			};
			byKey.set(key, receipt);
		}

		receipt.rows.push(row);
	}

	// Rows arrive in whatever order the join produced. Everything a receipt exposes
	// is put in calendar order together, so `ids`, `months` and `rows` always line up.
	for (const receipt of byKey.values()) {
		receipt.rows.sort(byPeriod);
		receipt.ids = receipt.rows.map((row) => row.id);
		receipt.months = receipt.rows.map((row) => ({
			id: row.id,
			month: row.month,
			year: row.year
		}));
		receipt.head = receipt.rows[0];
	}

	return [...byKey.values()];
}

/** `"12,13,14"` — how a receipt's rows travel through a form field. */
export function idsField(ids: number[]): string {
	return ids.join(',');
}

/**
 * Reads that field back. Anything non-numeric is dropped rather than turned
 * into `NaN` and handed to a `WHERE id IN (...)`.
 */
export function parseIdsField(raw: FormDataEntryValue | string | null | undefined): number[] {
	return String(raw ?? '')
		.split(',')
		.map((part) => Number(part.trim()))
		.filter((id) => Number.isInteger(id) && id > 0);
}
