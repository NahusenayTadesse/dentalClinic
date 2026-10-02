import type { LookupConfig } from '@nahu/admin-kit/components/lookup/types.js';

/**
 * What a visit can be for.
 *
 * `defaultMinutes` is the field that earns its keep: the person booking is rarely the person who
 * knows how long an extraction takes, so the type tells them.
 */
export const config: LookupConfig = {
	entity: 'Appointment Type',
	plural: 'Appointment Types',
	fields: [
		{ name: 'name', label: 'Name', type: 'text' },
		{ name: 'defaultMinutes', label: 'Default Minutes', type: 'number' },
		{
			name: 'recallIntervalMonths',
			label: 'Recall After (months)',
			type: 'number',
			required: false,
			placeholder: '6 for a check-up; 0 for none'
		},
		{ name: 'colour', label: 'Colour', type: 'text', required: false, placeholder: '#2563eb' },
		{ name: 'description', label: 'Description', type: 'text', required: false },
		{ name: 'sortOrder', label: 'Order', type: 'number', required: false },
		{ name: 'status', label: 'Status', type: 'boolean' }
	]
};
