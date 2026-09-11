import type { LookupConfig } from '$lib/components/lookup/types';

/**
 * The conditions a clinic can record against a patient.
 *
 * `Dental` is what splits the two lists the app offers: a dentist charting picks from the short
 * dental list, while medical history offers everything. Coding is where this goes wrong in
 * practice — providers pick the wrong entry when the list is long — so keeping the flag honest
 * matters more than it looks.
 *
 * `HMIS Code` is the Ministry's National Classification of Diseases serial number and is what a
 * statutory return is built from. It ships empty: the list is the Ministry's, and a guessed code
 * files a wrong report silently.
 */
export const config: LookupConfig = {
	entity: 'Condition',
	plural: 'Conditions',
	fields: [
		{ name: 'name', label: 'Name', type: 'text' },
		{ name: 'category', label: 'Category', type: 'text', required: false },
		{
			name: 'isDentalRelated',
			label: 'Dental',
			type: 'checkbox',
			trueLabel: 'Dental',
			falseLabel: 'Medical'
		},
		{ name: 'hmisCode', label: 'HMIS Code', type: 'text', required: false },
		{ name: 'icdCode', label: 'ICD Code', type: 'text', required: false },
		{ name: 'sortOrder', label: 'Order', type: 'number', required: false },
		{ name: 'status', label: 'Status', type: 'boolean' }
	]
};
