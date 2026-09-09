import type { LookupConfig } from '$lib/components/lookup/types';

export const config: LookupConfig = {
	entity: 'Pension Type',
	plural: 'Pension Types',
	fields: [
		{ name: 'name', label: 'Name', type: 'text' },
		{ name: 'rate', label: 'Rate', type: 'number' },
		{ name: 'status', label: 'Status', type: 'boolean' }
	]
};
