/**
 * The dropdown choices the supplies section filters on, shared by the loaders
 * and the pages.
 *
 * These pages used to carry a free-form condition builder — "description
 * contains…", "reference does not contain…" — which asked the user to guess
 * what the data says. Every filter here is instead a closed list of real
 * choices, so a filter can only ever be set to something that exists.
 *
 * Values are slugs, not display text: they end up in the URL, and a filtered
 * view is meant to be a link someone can send on.
 */

export type Option = { value: string; name: string };

/** The label for a chosen value, or `fallback` when nothing is chosen. */
export function labelOf(options: Option[], value: string | null | undefined, fallback: string) {
	if (!value) return fallback;
	return options.find((option) => option.value === value)?.name ?? fallback;
}

// --- Supplies -------------------------------------------------------------

/** `supplies.returnable`, spelled the way the table's Kind column spells it. */
export const SUPPLY_KINDS: Option[] = [
	{ value: 'returnable', name: 'Returnable' },
	{ value: 'consumable', name: 'Consumable' }
];

/**
 * Where a supply sits against its reorder level.
 *
 * Measured against stock on hand — the sum of the item's open lots. It used to be measured
 * against what was "claimable", meaning the shelf count minus whatever an approved lease had
 * promised away; leases went with the facilities prune, so the shelf count is the whole story.
 */
export const STOCK_STATUSES: Option[] = [
	{ value: 'in-stock', name: 'In stock' },
	{ value: 'at-reorder', name: 'At or below reorder' },
	{ value: 'out-of-stock', name: 'Out of stock' }
];

/** Stands in for a NULL `unit_of_measure` so it can be picked from the list. */
export const UNSPECIFIED_UNIT = 'unspecified';

// --- Suppliers ------------------------------------------------------------

export const SUPPLIER_STATUSES: Option[] = [
	{ value: 'active', name: 'Active' },
	{ value: 'inactive', name: 'Inactive' }
];

/**
 * Whether anything has been bought from this supplier. Scoped to the date range
 * when one is set, so "never supplied" reads as "nothing in this window".
 */
export const SUPPLIER_ACTIVITY: Option[] = [
	{ value: 'has-supplied', name: 'Has supplied' },
	{ value: 'never-supplied', name: 'Never supplied' }
];

export const SUPPLIER_CONTACT: Option[] = [
	{ value: 'with-email', name: 'Phone and email' },
	{ value: 'phone-only', name: 'Phone only' }
];
