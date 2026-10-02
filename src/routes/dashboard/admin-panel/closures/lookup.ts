import type { LookupConfig } from '@nahu/admin-kit/components/lookup/types.js';

/**
 * Days the clinic is shut.
 *
 * The branch picker is optional on purpose: left empty the closure applies to every branch,
 * which is what a public holiday means and what a single-branch clinic always wants.
 *
 * Movable feasts — Fasika, Eid al-Fitr, Eid al-Adha, Mawlid — are the reason this screen exists
 * rather than a fixed list in code. They move every year against both calendars and have to be
 * entered by hand.
 */
export const config: LookupConfig = {
	entity: 'Closure',
	plural: 'Closures',
	fields: [
		{ name: 'name', label: 'Name', type: 'text' },
		{ name: 'startsOn', label: 'From', type: 'date' },
		{ name: 'endsOn', label: 'To', type: 'date' },
		{
			name: 'branchId',
			label: 'Branch',
			type: 'reference',
			required: false,
			options: 'branchList',
			display: 'branch',
			picker: 'select'
		},
		{ name: 'note', label: 'Note', type: 'text', required: false },
		{ name: 'status', label: 'Status', type: 'boolean' }
	]
};
