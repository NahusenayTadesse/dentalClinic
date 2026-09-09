import type { LookupConfig } from '$lib/components/lookup/types';

export const config: LookupConfig = {
	entity: 'Leave Type',
	plural: 'Leave Types',
	fields: [
		{ name: 'name', label: 'Name', type: 'text' },
		{ name: 'maxDays', label: 'Maximum Days Allowed', type: 'number' },
		{
			name: 'deductsBalance',
			label: 'Drawn From Accrued Balance',
			type: 'boolean',
			trueLabel: 'Yes — spends accrued annual leave days',
			falseLabel: 'No — granted on top of the balance',
			inTable: false
		},
		{ name: 'description', label: 'Description', type: 'textarea' },
		{ name: 'status', label: 'Status', type: 'boolean' }
	]
};
