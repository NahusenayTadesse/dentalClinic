import type { LookupConfig } from '$lib/components/lookup/types';
import { SERVICE_AREAS, SERVICE_AREA_LABELS } from '$lib/serviceAreas';

/**
 * The treatments the clinic offers, what each one normally costs, and what it is charted on.
 *
 * `Price` is where a procedure's fee starts; it is copied, never referenced, so changing it here
 * cannot move a quote or a bill already given. `Charted on` decides what the chart asks for when
 * the service is recorded against a patient: a filling asks for surfaces, an extraction for a
 * tooth, an examination for neither. `Removes the tooth` is what draws a gap on the chart once an
 * extraction is done.
 */
export const config: LookupConfig = {
	entity: 'Service',
	plural: 'Services',
	fields: [
		{ name: 'name', label: 'Name', type: 'text' },
		{
			name: 'categoryId',
			label: 'Category',
			type: 'reference',
			options: 'categoryList',
			display: 'category'
		},
		{ name: 'price', label: 'Price', type: 'money', required: false },
		{
			name: 'area',
			label: 'Charted on',
			type: 'select',
			choices: SERVICE_AREAS.map((value) => ({ value, name: SERVICE_AREA_LABELS[value] }))
		},
		{
			name: 'removesTooth',
			label: 'Removes the tooth',
			type: 'checkbox',
			trueLabel: 'Extraction',
			falseLabel: '—'
		},
		{ name: 'description', label: 'Description', type: 'textarea', required: false },
		{ name: 'status', label: 'Status', type: 'boolean' }
	]
};
