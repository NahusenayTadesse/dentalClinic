import type { LookupConfig } from '@nahu/admin-kit/components/lookup/types.js';

/**
 * The substances a patient can be recorded as reacting to.
 *
 * Adding a row here has clinical weight, unlike adding a contact channel: it becomes an option a
 * clinician picks under time pressure. The seeded list is what a dental clinic actually meets,
 * and near-duplicates ("Penicillin V" next to "Penicillin") are the thing to avoid, because two
 * spellings split the very query this table exists to answer.
 */
export const config: LookupConfig = {
	entity: 'Allergen',
	plural: 'Allergens',
	fields: [
		{ name: 'name', label: 'Name', type: 'text' },
		{
			name: 'category',
			label: 'Category',
			type: 'select',
			choices: [
				{ value: 'medication', name: 'Medication' },
				{ value: 'anaesthetic', name: 'Anaesthetic' },
				{ value: 'material', name: 'Dental material' },
				{ value: 'food', name: 'Food' },
				{ value: 'environmental', name: 'Environmental' },
				{ value: 'other', name: 'Other' }
			]
		},
		{ name: 'description', label: 'Description', type: 'text', required: false },
		{ name: 'sortOrder', label: 'Order', type: 'number', required: false },
		{ name: 'status', label: 'Status', type: 'boolean' }
	]
};
