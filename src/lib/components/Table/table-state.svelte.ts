/**
 * The part of the table that knows whether the server or the browser is doing the work.
 *
 * A table here runs in one of two modes, and almost every bug this module exists to prevent comes
 * from mixing them:
 *
 *   **client** — the load returned every row. TanStack filters, sorts and paginates in memory,
 *                and facet tallies are counted off the rows. Right for lookup tables and any list
 *                that is bounded by its nature.
 *   **server**  — the load returned one page. `LIMIT`/`OFFSET`, the `WHERE` and the `ORDER BY`
 *                are SQL, TanStack is told not to redo any of it, and the facet tallies arrive
 *                beside the page from `facetCounts`.
 *
 * **The mixed case is what was shipping.** Four pages ran the server-side filter bar and the
 * client-side facet menu at once, so `/dashboard/employees` counted facets and drew its chart
 * from whichever twenty-five rows the server had returned, and presented them as the clinic. The
 * numbers were wrong and nothing said so. A table in server mode therefore never derives a tally
 * from its rows: it either has server facets or it shows none.
 *
 * Non-goal: deciding the mode. A page is in server mode exactly when it passes `server`, because
 * that is the page that already did the paging.
 */
/** What a server-driven page hands the table, alongside its rows. */
export type ServerTable = {
	/** Straight from `pagination(query, total)`. */
	pagination: { page: number; pageSize: number; total: number };
	/**
	 * Facets from `facetCounts`, keyed by column id.
	 *
	 * Absent means "this page did not compute them", and the table shows no facets rather than
	 * counting the page — which is the whole point of the split.
	 */
	facets?: Record<string, Facet[]>;
	/** What the URL currently asks for, so the controls show their own state. */
	filters?: Record<string, string | null | undefined>;
};

/**
 * One value a column can be filtered by.
 *
 * `value` is what goes into the URL or the client-side comparison; `label` is what the reader
 * sees. They differ whenever the column is a foreign key — `value` is the id, `label` is the
 * name. Collapsing them shipped once and broke every foreign-key facet: clicking "Piassa Clinic"
 * wrote `branchId=Piassa+Clinic`, the filter did `Number(...)` on it and matched nothing.
 */
export type Facet = { value: string; label: string; count: number };

/**
 * Facet tallies counted from rows already in memory.
 *
 * Each column is counted with every *other* column's selection applied but not its own, so the
 * options within one facet stay comparable. Counting a facet through its own filter would leave
 * the chosen value showing its true count and every sibling showing zero.
 */
export function facetsFromRows(
	rows: Record<string, unknown>[],
	keys: string[],
	selected: Record<string, string[]>
): Record<string, Facet[]> {
	const out: Record<string, Facet[]> = {};

	for (const key of keys) {
		const tally: Record<string, number> = {};

		for (const row of rows) {
			const matchesOthers = keys.every((other) => {
				if (other === key) return true;
				const picked = selected[other] ?? [];
				return picked.length === 0 || picked.includes(String(row[other]));
			});

			if (!matchesOthers) continue;

			const value = row[key];
			if (value === null || value === undefined || value === '') continue;

			const label = String(value);
			tally[label] = (tally[label] ?? 0) + 1;
		}

		// Client mode filters on the displayed value itself, so value and label are the same here.
		out[key] = Object.entries(tally)
			.map(([label, count]) => ({ value: label, label, count }))
			.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
	}

	return out;
}

/** Keeps only the rows matching every selected facet. Client mode's filter step. */
export function applyFacets<T extends Record<string, unknown>>(
	rows: T[],
	selected: Record<string, string[]>
): T[] {
	const active = Object.entries(selected).filter(([, values]) => values.length > 0);
	if (!active.length) return rows;

	return rows.filter((row) => active.every(([key, values]) => values.includes(String(row[key]))));
}

/** How many individual values are selected across every column. */
export function selectionCount(selected: Record<string, string[]>): number {
	return Object.values(selected).reduce((total, values) => total + values.length, 0);
}

/**
 * Writes server-mode state to the URL.
 *
 * `$lib/queryFilters` is imported on use rather than at the top of this module, and that is not
 * micro-optimisation: it reaches `$app/navigation` and `$app/state`, which would put the whole of
 * SvelteKit's routing runtime into the module graph of every table — including the great majority
 * that are in client mode and never navigate. It also made the component impossible to mount in a
 * component test, which is how this was found.
 */
async function writeQuery(overrides: Record<string, string | number | null>) {
	const { navigateWithQuery } = await import('$lib/queryFilters');
	navigateWithQuery(overrides);
}

/**
 * Moves the server-mode table to a page.
 *
 * The URL is the state — `parseTableQuery` reads it on the next load — so paging is a navigation
 * rather than a local update. `navigateWithQuery` keeps focus and suppresses the scroll jump, so
 * the pager does not move out from under the pointer.
 */
export function gotoPage(page: number) {
	void writeQuery({ page });
}

/** Changes the server-mode page size, returning to page one because the offsets have moved. */
export function setServerPageSize(pageSize: number) {
	void writeQuery({ pageSize, page: 1 });
}

/**
 * Writes the search term to the URL, debounced.
 *
 * Debounced because every keystroke would otherwise be a round trip and a history entry. The
 * delay is deliberately longer than a local filter would need: this is a query, and a clinic on a
 * slow connection should not be issuing one per character.
 */
let searchTimer: ReturnType<typeof setTimeout> | undefined;

export function setServerSearch(term: string, delayMs = 350) {
	clearTimeout(searchTimer);
	searchTimer = setTimeout(
		() => void writeQuery({ search: term.trim() || null, page: 1 }),
		delayMs
	);
}

/**
 * Writes one column's facet selection to the URL.
 *
 * Server filters are single-valued — `parseTableQuery` reads one string per key — so selecting a
 * second value replaces the first rather than adding to it. Client mode is multi-select, and the
 * popover says which it is by what it renders.
 */
export function setServerFacet(key: string, value: string | null) {
	void writeQuery({ [key]: value, page: 1 });
}
