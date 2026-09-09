import type { LookupConfig } from '$lib/components/lookup/types';

export const config: LookupConfig = {
	entity: 'Service',
	plural: 'Services',
	fields: [
		{ name: 'name', label: 'Name', type: 'text' },
		{
			name: 'categoryId',
			label: 'Category',
			type: 'reference',
			options: 'categoryList',
			display: 'category'
		},
		{ name: 'description', label: 'Description', type: 'textarea' },
		{ name: 'status', label: 'Status', type: 'boolean' }
	]
};
