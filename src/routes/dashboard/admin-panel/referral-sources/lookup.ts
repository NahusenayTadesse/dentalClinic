import type { LookupConfig } from '$lib/components/lookup/types';

/**
 * How patients find the clinic.
 *
 * The only reason to record this is to count it, which is why it is a list rather than a text box.
 * It is also the one marketing figure a clinic with no marketing budget can act on: if the board
 * outside brings nobody and word of mouth brings everybody, that is a decision about where the
 * next birr goes.
 */
export const config: LookupConfig = {
	entity: 'Referral Source',
	plural: 'Referral Sources',
	fields: [
		{ name: 'name', label: 'Name', type: 'text' },
		{ name: 'description', label: 'Description', type: 'text', required: false },
		{ name: 'sortOrder', label: 'Order', type: 'number', required: false },
		{ name: 'status', label: 'Status', type: 'boolean' }
	]
};
