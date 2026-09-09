import type { LookupConfig } from '$lib/components/lookup/types';

export const config: LookupConfig = {
	entity: 'Position',
	plural: 'Positions',
	fields: [
		{ name: 'name', label: 'Name', type: 'text' },
		{
			name: 'departmentId',
			label: 'Department',
			type: 'reference',
			options: 'departmentList',
			display: 'department'
		},
		{ name: 'status', label: 'Status', type: 'boolean' }
	]
};
