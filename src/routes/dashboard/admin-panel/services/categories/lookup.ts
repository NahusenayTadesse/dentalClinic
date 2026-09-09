import type { LookupConfig } from '$lib/components/lookup/types';

export const config: LookupConfig = {
	entity: 'Service Category',
	plural: 'Service Categories',
	fields: [
		{ name: 'name', label: 'Name', type: 'text' },
		{ name: 'description', label: 'Description', type: 'textarea' },
		{ name: 'status', label: 'Status', type: 'boolean' }
	]
};
