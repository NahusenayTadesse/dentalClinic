import type { LookupConfig } from '@nahu/admin-kit/components/lookup/types.js';
import { CONSENT_PLACEHOLDERS, CONSENT_TYPES } from '$lib/consentForms';
import { forms } from '$lib/i18n/messages/en/forms';

const placeholders = Object.keys(CONSENT_PLACEHOLDERS)
	.map((p) => `{${p}}`)
	.join(', ');

/**
 * The wording of the consent forms a patient signs, in English and Amharic. A clinic edits the
 * wording its lawyer approves; the Consents tab prints it with the patient's name and the treatment
 * filled in (`$lib/consentForms.ts`). Two forms of one kind are fine — "Extraction of a wisdom
 * tooth" beside the general surgical one.
 */
export const config: LookupConfig = {
	entity: 'Consent form',
	plural: 'Consent forms',
	fields: [
		{ name: 'name', label: 'Name', type: 'text', placeholder: 'Extraction of a wisdom tooth' },
		{
			name: 'consentType',
			label: 'Consent to',
			type: 'select',
			choices: CONSENT_TYPES.map((t) => ({ value: t, name: forms.consent.types[t] }))
		},
		{
			name: 'bodyEn',
			label: 'English wording',
			type: 'textarea',
			placeholder: `Filled in when printed: ${placeholders}. A blank line starts a new paragraph.`
		},
		{
			name: 'bodyAm',
			label: 'Amharic wording',
			type: 'textarea',
			placeholder: `The same placeholders, in Latin letters: ${placeholders}.`
		},
		{ name: 'status', label: 'Status', type: 'boolean' }
	]
};
