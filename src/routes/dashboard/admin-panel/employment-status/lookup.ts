import type { LookupConfig } from '@nahu/admin-kit/components/lookup/types.js';

export const config: LookupConfig = {
	entity: 'Employment Status',
	plural: 'Employment Statuses',
	fields: [
		{ name: 'name', label: 'Name', type: 'text' },
		{ name: 'description', label: 'Description', type: 'textarea' },
		{
			name: 'removeFromLists',
			label: 'Remove From Employee Lists',
			type: 'checkbox',
			trueLabel: 'Removable',
			falseLabel: 'Unremovable'
		},
		// Only one status may carry this flag, so it is set here but not listed.
		{
			name: 'terminationStatus',
			label: 'Assigned to Terminated Employees',
			type: 'checkbox',
			inTable: false
		},
		{ name: 'status', label: 'Status', type: 'boolean' }
	]
};
