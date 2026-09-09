import type { LookupConfig } from '$lib/components/lookup/types';

export const config: LookupConfig = {
	entity: 'City',
	plural: 'Cities',
	fields: [
		{ name: 'name', label: 'Name', type: 'text' },
		{
			name: 'regionId',
			label: 'Region',
			type: 'reference',
			options: 'regionList',
			display: 'region'
		},
		{ name: 'status', label: 'Status', type: 'boolean' }
	]
};
