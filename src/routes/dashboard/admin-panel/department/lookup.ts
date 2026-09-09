import type { LookupConfig } from '$lib/components/lookup/types';

export const config: LookupConfig = {
	entity: 'Department',
	plural: 'Departments',
	fields: [
		{ name: 'name', label: 'Name', type: 'text' },
		{
			name: 'commission',
			label: "Calculate Commission for this department's employees",
			type: 'boolean',
			trueLabel: 'Calculated',
			falseLabel: 'Not Calculated'
		},
		// In the form only: the table has never shown it, and it is long prose.
		{ name: 'description', label: 'Description', type: 'textarea', inTable: false },
		{ name: 'status', label: 'Status', type: 'boolean' }
	]
};
