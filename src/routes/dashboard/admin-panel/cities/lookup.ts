import type { LookupConfig } from '@nahu/admin-kit/components/lookup/types.js';

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
