import type { LookupConfig } from '@nahu/admin-kit/components/lookup/types.js';

/**
 * The consent section's table and form, as data — the client half of `section.ts`. The witness,
 * the treatment and the scanned form are references whose options the tab loads for this patient.
 */
export const consentConfig: LookupConfig = {
	entity: 'Consent',
	plural: 'Consents',
	fields: [
		{
			name: 'consentType',
			label: 'Consent to',
			type: 'select',
			choices: [
				{ value: 'treatment', name: 'Treatment here' },
				{ value: 'surgical', name: 'Surgery or extraction' },
				{ value: 'anaesthetic', name: 'Sedation or anaesthetic' },
				{ value: 'radiograph', name: 'Radiographs' },
				{ value: 'photography', name: 'Clinical photographs' },
				{ value: 'dataSharing', name: 'Sharing records' }
			]
		},
		{
			name: 'method',
			label: 'How',
			type: 'select',
			choices: [
				{ value: 'written', name: 'Written, signed' },
				{ value: 'verbal', name: 'Verbal, before a witness' },
				{ value: 'electronic', name: 'Electronic' }
			]
		},
		{ name: 'givenOn', label: 'Given on', type: 'date' },
		{
			name: 'givenBy',
			label: 'Given by',
			type: 'text',
			required: false,
			placeholder: 'Leave empty when the patient gave it themself'
		},
		{
			name: 'relationship',
			label: 'Relationship',
			type: 'text',
			required: false,
			placeholder: 'Mother, guardian…'
		},
		{ name: 'witnessedBy', label: 'Witness', type: 'reference', picker: 'select', required: false },
		{
			name: 'procedureId',
			label: 'For the treatment',
			type: 'reference',
			picker: 'select',
			required: false
		},
		{
			name: 'documentFileId',
			label: 'Signed form',
			type: 'reference',
			picker: 'select',
			required: false,
			inTable: false
		},
		{ name: 'withdrawnOn', label: 'Withdrawn on', type: 'date', inForm: false },
		{
			name: 'withdrawnReason',
			label: 'Withdrawn because',
			type: 'text',
			required: false,
			placeholder: 'Fill in only if the patient has withdrawn it'
		},
		{ name: 'note', label: 'Note', type: 'textarea', rows: 2, required: false, inTable: false }
	]
};
