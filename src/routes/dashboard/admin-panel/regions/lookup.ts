import type { LookupConfig } from '$lib/components/lookup/types';

export const config: LookupConfig = {
	entity: 'Region',
	plural: 'Regions',
	fields: [
		{ name: 'name', label: 'Name', type: 'text' },
		{ name: 'status', label: 'Status', type: 'boolean' }
	]
};
