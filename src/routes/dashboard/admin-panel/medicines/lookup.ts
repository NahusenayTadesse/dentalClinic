import type { LookupConfig } from '@nahu/admin-kit/components/lookup/types.js';

/**
 * The clinic's medicine list: what it prescribes, and what patients arrive already taking.
 *
 * One list serves both, which is why `Prescribable` is a field rather than a second table.
 * Warfarin has to be recordable on a patient's medication list and must never appear on the
 * prescribing picker, and the flag is the only thing that keeps the two apart.
 *
 * The three risk flags are facts about the drug that change what a dentist does next. They are
 * set here, once, so the chart can warn on every patient taking the drug without anyone
 * re-deciding it per patient. The schema comment on `medicine` says what each one triggers.
 */
export const config: LookupConfig = {
	entity: 'Medicine',
	plural: 'Medicines',
	fields: [
		{ name: 'genericName', label: 'Generic name', type: 'text' },
		{ name: 'brandName', label: 'Brand', type: 'text', required: false },
		{ name: 'strength', label: 'Strength', type: 'text', required: false, placeholder: '500mg' },
		{
			name: 'form',
			label: 'Form',
			type: 'select',
			choices: [
				{ value: 'tablet', name: 'Tablet' },
				{ value: 'capsule', name: 'Capsule' },
				{ value: 'syrup', name: 'Syrup' },
				{ value: 'suspension', name: 'Suspension' },
				{ value: 'injection', name: 'Injection' },
				{ value: 'mouthwash', name: 'Mouthwash' },
				{ value: 'gel', name: 'Gel' },
				{ value: 'cream', name: 'Cream' },
				{ value: 'other', name: 'Other' }
			]
		},
		{
			name: 'allergenId',
			label: 'Allergy family',
			type: 'reference',
			options: 'allergenList',
			display: 'allergen',
			picker: 'select',
			// The allergy a patient would have to this because of what it is — amoxicillin is a
			// penicillin. Prescriptions are checked against it (`$lib/allergyClash.ts`).
			required: false
		},
		{
			name: 'isPrescribable',
			label: 'Prescribable',
			type: 'checkbox',
			trueLabel: 'Prescribed here',
			falseLabel: 'Record only'
		},
		{
			name: 'isAntibiotic',
			label: 'Antibiotic',
			type: 'checkbox',
			trueLabel: 'Antibiotic',
			falseLabel: '—'
		},
		{
			name: 'bleedingRisk',
			label: 'Bleeding risk',
			type: 'checkbox',
			trueLabel: 'Bleeding risk',
			falseLabel: '—'
		},
		{
			name: 'osteonecrosisRisk',
			label: 'Jaw osteonecrosis risk',
			type: 'checkbox',
			trueLabel: 'MRONJ risk',
			falseLabel: '—'
		},
		{
			name: 'immunosuppression',
			label: 'Immunosuppressant',
			type: 'checkbox',
			trueLabel: 'Immunosuppressant',
			falseLabel: '—'
		},
		{
			name: 'controlClass',
			label: 'EFDA control',
			type: 'select',
			required: false,
			choices: [
				{ value: '', name: 'Not controlled' },
				{ value: 'narcotic', name: 'Narcotic' },
				{ value: 'psychotropic', name: 'Psychotropic' }
			]
		},
		{
			name: 'isOnEml',
			label: 'On the Essential Medicines List',
			type: 'checkbox',
			trueLabel: 'EML',
			falseLabel: 'Not on EML',
			inTable: false
		},
		{ name: 'notes', label: 'Cautions', type: 'textarea', required: false, inTable: false },
		{ name: 'sortOrder', label: 'Order', type: 'number', required: false, inTable: false },
		{ name: 'status', label: 'Status', type: 'boolean' }
	]
};
