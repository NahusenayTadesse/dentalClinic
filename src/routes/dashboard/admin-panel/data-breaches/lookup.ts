import type { LookupConfig } from '@nahu/admin-kit/components/lookup/types.js';

/**
 * The breach log: every personal-data breach, what was done, and whether the authority and the
 * people affected were told. Kept for the small ones too — the proclamation asks for the record,
 * and the record is what shows a clinic took it seriously.
 */
export const config: LookupConfig = {
	entity: 'Breach',
	plural: 'Breaches',
	fields: [
		{ name: 'title', label: 'What happened', type: 'text', placeholder: 'Reception laptop stolen' },
		{ name: 'discoveredOn', label: 'Found on', type: 'date' },
		{ name: 'occurredOn', label: 'Happened on', type: 'date', required: false },
		{
			name: 'severity',
			label: 'How serious',
			type: 'select',
			choices: [
				{ value: 'low', name: 'Low — little or no harm likely' },
				{ value: 'medium', name: 'Medium' },
				{ value: 'high', name: 'High — health or financial data exposed' }
			]
		},
		{ name: 'description', label: 'Details, and the data it touched', type: 'textarea' },
		{ name: 'peopleAffected', label: 'People affected', type: 'number', required: false },
		{ name: 'actions', label: 'What was done', type: 'textarea', required: false },
		{ name: 'reportedOn', label: 'Reported to the authority on', type: 'date', required: false },
		{ name: 'notifiedOn', label: 'People affected told on', type: 'date', required: false },
		{
			name: 'status',
			label: 'Open',
			type: 'checkbox',
			trueLabel: 'Open',
			falseLabel: 'Closed'
		}
	]
};
