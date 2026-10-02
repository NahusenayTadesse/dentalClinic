import type { LookupConfig } from '@nahu/admin-kit/components/lookup/types.js';

/** What an expense is filed under — rent, supplies, utilities — on the expenses list and reports. */
export const config: LookupConfig = {
	entity: 'Expense Category',
	plural: 'Expense Categories',
	fields: [
		{ name: 'name', label: 'Name', type: 'text' },
		{ name: 'description', label: 'Description', type: 'text', required: false },
		{ name: 'status', label: 'Status', type: 'boolean' }
	]
};
