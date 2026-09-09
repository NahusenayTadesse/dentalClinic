import type { LookupConfig } from '$lib/components/lookup/types';

export const config: LookupConfig = {
	entity: 'Tax Type',
	plural: 'Tax Types',
	fields: [
		{ name: 'name', label: 'Name', type: 'text' },
		{ name: 'rate', label: 'Rate', type: 'number' },
		{ name: 'threshold', label: 'Threshold', type: 'number' },
		{ name: 'deduction', label: 'Deduction', type: 'number' },
		{ name: 'status', label: 'Status', type: 'boolean' }
	]
};
