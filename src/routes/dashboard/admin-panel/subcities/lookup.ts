import type { LookupConfig } from '$lib/components/lookup/types';

export const config: LookupConfig = {
	entity: 'Subcity',
	plural: 'Subcities',
	fields: [
		{ name: 'name', label: 'Name', type: 'text' },
		{
			name: 'cityId',
			label: 'City',
			type: 'reference',
			options: 'cityList',
			display: 'city'
		},
		{ name: 'status', label: 'Status', type: 'boolean' }
	]
};
