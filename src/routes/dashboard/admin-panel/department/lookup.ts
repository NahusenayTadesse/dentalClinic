import type { LookupConfig } from '@nahu/admin-kit/components/lookup/types.js';

export const config: LookupConfig = {
	entity: 'Department',
	plural: 'Departments',
	fields: [
		{ name: 'name', label: 'Name', type: 'text' },
		{
			name: 'commission',
			/*
			 * Stored as `commission`, and labelled "Calculate Commission" until it was found that
			 * nothing calculates one: what the flag actually decides is who counts as office staff
			 * (`officeEmployees` in fastData) — who can hold a user account.
			 */
			label: 'Office staff — can be given a user account',
			type: 'boolean',
			trueLabel: 'Office',
			falseLabel: 'Not office'
		},
		// In the form only: the table has never shown it, and it is long prose.
		{ name: 'description', label: 'Description', type: 'textarea', inTable: false },
		{ name: 'status', label: 'Status', type: 'boolean' }
	]
};
