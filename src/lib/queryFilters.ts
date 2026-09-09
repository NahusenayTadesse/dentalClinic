/**
 * The client half of server-side table filtering — see
 * `$lib/server/queryFilters.ts` for the half that runs the query.
 *
 * `QueryBuilder.svelte` reports what the user picked; something has to turn
 * that into a URL, because the URL is what the load function reads. Every list
 * page used to carry its own copy of that translation. They are all this:
 */
import { goto } from '$app/navigation';
import { page } from '$app/state';

/** What the filter bar hands back whenever the query changes. */
export type QueryFilterPayload<T extends Record<string, unknown> = Record<string, unknown>> = {
	search: string;
	pageSize: number;
	/** `CalendarDate` ends, or null when the page does not show a date range. */
	dateRange: { start: { toString(): string }; end: { toString(): string } } | null;
	customFilters: T;
};

/**
 * Writes `overrides` onto the current URL and navigates. An empty value drops
 * its param rather than writing `?x=`, so a cleared filter leaves a clean URL
 * and `parseTableQuery` sees it as unset.
 *
 * Params it is not given are left alone — that is what lets the reports layout
 * keep its open section across a filter change.
 */
export function navigateWithQuery(overrides: Record<string, string | number | null>) {
	const params = new URLSearchParams(page.url.searchParams);

	for (const [key, value] of Object.entries(overrides)) {
		if (value === null || value === '') params.delete(key);
		else params.set(key, String(value));
	}

	goto(`${page.url.pathname}?${params.toString()}`, { keepFocus: true, noScroll: true });
}

/**
 * Turns a filter-bar payload into a navigation. Pass it straight to the bar:
 *
 *   <QueryBuilder onQueryChange={applyQueryToUrl} … />
 *
 * The page cursor always resets: page 4 of the old result set is not page 4 of
 * the new one.
 */
export function applyQueryToUrl<T extends Record<string, unknown>>(payload: QueryFilterPayload<T>) {
	const overrides: Record<string, string | number | null> = {
		search: payload.search || null,
		pageSize: payload.pageSize,
		page: 1
	};

	// Written on every navigation, not only when a range is set: a cleared range
	// has to take `dateStart`/`dateEnd` out of the URL with it, and only `null`
	// deletes a param. Skipping the else left the old window in the URL, so
	// "Clear all" silently kept filtering by date.
	overrides.dateStart = payload.dateRange ? payload.dateRange.start.toString() : null;
	overrides.dateEnd = payload.dateRange ? payload.dateRange.end.toString() : null;

	for (const [key, value] of Object.entries(payload.customFilters)) {
		overrides[key] = value === null || value === undefined ? null : String(value);
	}

	navigateWithQuery(overrides);
}
