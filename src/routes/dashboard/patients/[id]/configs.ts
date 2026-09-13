import type { LookupConfig } from '$lib/components/lookup/types';

/**
 * How each child section of the chart looks: its table columns and its form fields, as data.
 *
 * The client half of `sections.ts`. Reference fields name their options by field — the page loads
 * `allergenId`'s options once and every allergy row and form uses them.
 */

export const allergyConfig: LookupConfig = {
	entity: 'Allergy',
	plural: 'Allergies',
	fields: [
		{ name: 'allergenId', label: 'Allergen', type: 'reference', picker: 'combo' },
		{
			name: 'severity',
			label: 'Severity',
			type: 'select',
			choices: [
				{ value: 'severe', name: 'Severe' },
				{ value: 'moderate', name: 'Moderate' },
				{ value: 'mild', name: 'Mild' },
				{ value: 'unknown', name: 'Not assessed' }
			]
		},
		{
			name: 'reaction',
			label: 'Reaction',
			type: 'text',
			required: false,
			placeholder: 'Hives, swelling, anaphylaxis…'
		}
	]
};

export const conditionConfig: LookupConfig = {
	entity: 'Condition',
	plural: 'Conditions',
	fields: [
		{ name: 'conditionId', label: 'Condition', type: 'reference', picker: 'combo' },
		{
			name: 'status',
			label: 'Status',
			type: 'select',
			choices: [
				{ value: 'active', name: 'Active' },
				{ value: 'suspected', name: 'Suspected' },
				{ value: 'inRemission', name: 'In remission' },
				{ value: 'resolved', name: 'Resolved' }
			]
		},
		{ name: 'resolvedOn', label: 'Resolved on', type: 'date', inForm: false },
		{ name: 'note', label: 'Note', type: 'textarea', rows: 3, required: false }
	]
};

export const medicationConfig: LookupConfig = {
	entity: 'Medication',
	plural: 'Medications',
	fields: [
		{
			name: 'nameAsReported',
			label: 'Medicine (as the patient says it)',
			type: 'text',
			placeholder: 'Coumadin, "the blood thinner"…'
		},
		{
			name: 'medicineId',
			label: 'Matches formulary medicine',
			type: 'reference',
			picker: 'combo',
			required: false
		},
		{ name: 'dose', label: 'Dose', type: 'text', required: false, placeholder: '5 mg' },
		{
			name: 'frequency',
			label: 'How often',
			type: 'text',
			required: false,
			placeholder: 'Once daily'
		},
		{
			name: 'status',
			label: 'Status',
			type: 'select',
			choices: [
				{ value: 'active', name: 'Taking' },
				{ value: 'stopped', name: 'Stopped' },
				{ value: 'unknown', name: 'Not sure' }
			]
		},
		{ name: 'stoppedOn', label: 'Stopped on', type: 'date', inForm: false },
		{ name: 'note', label: 'Note', type: 'textarea', rows: 3, required: false }
	]
};

export const contactConfig: LookupConfig = {
	entity: 'Contact',
	plural: 'Contacts',
	fields: [
		{ name: 'value', label: 'Detail', type: 'text', placeholder: 'Email, username or number' },
		{ name: 'contactTypeId', label: 'Kind', type: 'reference', picker: 'select' },
		{ name: 'label', label: 'Label', type: 'text', required: false, placeholder: 'Work, home…' },
		{
			name: 'isPrimary',
			label: 'Primary',
			type: 'checkbox',
			required: false,
			trueLabel: 'Primary',
			falseLabel: '—'
		}
	]
};

export const emergencyContactConfig: LookupConfig = {
	entity: 'Emergency contact',
	plural: 'Emergency contacts',
	fields: [
		{ name: 'name', label: 'Name', type: 'text' },
		{ name: 'relation', label: 'Relation', type: 'text', required: false, placeholder: 'Mother' },
		{ name: 'phone', label: 'Phone', type: 'text', placeholder: '0911 23 45 67' },
		{ name: 'altPhone', label: 'Second phone', type: 'text', required: false },
		{
			name: 'isPrimary',
			label: 'Call first',
			type: 'checkbox',
			required: false,
			trueLabel: 'Call first',
			falseLabel: '—'
		}
	]
};
