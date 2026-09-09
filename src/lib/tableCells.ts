/**
 * Shared cell renderers for data tables.
 *
 * Lives outside `$lib/server` because `columns.ts` files run in the browser.
 */

import { renderComponent } from '$lib/components/ui/data-table/index.js';
import DataTableLinks from '$lib/components/Table/data-table-links.svelte';
import { formatEthiopianDate } from '$lib/global.svelte';

/** Where a user's detail page lives. */
export const USER_PAGE = '/dashboard/admin-panel/users';

/**
 * A user attribution cell: the name, linked to their admin page.
 *
 * Falls back to plain text when there is no id. Loads deliberately null the id
 * for a deleted user — `admin-panel/users/[id]` filters deleted users out, so
 * the link would lead nowhere — while still printing the name, because a
 * deleted user did still do the thing the row records.
 */
export function userCell(id: string | null | undefined, name: string | null | undefined) {
	if (!name) return '—';
	if (!id) return name;

	return renderComponent(DataTableLinks, { id: String(id), name, link: USER_PAGE });
}

/** Parses whatever the load handed over — a Date, an ISO string, or nothing. */
function toDate(value: unknown): Date | null {
	if (!value) return null;
	const date = value instanceof Date ? value : new Date(String(value));
	return isNaN(date.getTime()) ? null : date;
}

/**
 * A date in the Ethiopian calendar. Columns keep the raw value as their
 * accessor and format here, so sorting stays chronological rather than
 * alphabetical on the rendered text.
 */
export function ethiopianDate(value: unknown): string {
	const date = toDate(value);
	return date ? formatEthiopianDate(date) : '—';
}

/**
 * The same, with the wall-clock time appended. Used where the order of events
 * within a day matters — the audit trail and stock movements.
 */
export function ethiopianDateTime(value: unknown): string {
	const date = toDate(value);
	if (!date) return '—';

	const time = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
	return `${formatEthiopianDate(date)} · ${time}`;
}
