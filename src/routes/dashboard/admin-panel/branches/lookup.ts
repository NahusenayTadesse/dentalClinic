import type { LookupConfig } from '$lib/components/lookup/types';

/**
 * Clinic locations.
 *
 * `address` is deliberately not a field: it is a foreign key into `address`, which is a
 * six-part record (subcity, kebele, street, building, floor, house) rather than a name to pick
 * from a list. Editing one belongs on a detail page, the way `customers/[id]` does it. A
 * branch's phone is the number people actually call, so that carries the contact weight here.
 */
export const config: LookupConfig = {
	entity: 'Branch',
	plural: 'Branches',
	fields: [
		{ name: 'name', label: 'Name', type: 'text' },
		{ name: 'phone', label: 'Phone', type: 'text', required: false },
		{ name: 'openedOn', label: 'Opened On', type: 'date', required: false },
		{ name: 'status', label: 'Status', type: 'boolean' }
	]
};
