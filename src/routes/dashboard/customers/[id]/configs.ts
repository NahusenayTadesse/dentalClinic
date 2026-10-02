import type { LookupConfig } from '@nahu/admin-kit/components/lookup/types.js';

/** The payer's contacts: the client half of `sections.ts`. */
export const contactConfig: LookupConfig = {
	entity: 'Contact',
	plural: 'Contacts',
	fields: [
		{
			name: 'contactType',
			label: 'Type',
			type: 'select',
			choices: [
				{ value: 'phone', name: 'Phone number' },
				{ value: 'email', name: 'Email' },
				{ value: 'telegram', name: 'Telegram' },
				{ value: 'whatsapp', name: 'WhatsApp' },
				{ value: 'instagram', name: 'Instagram' }
			]
		},
		{ name: 'contactDetail', label: 'Contact', type: 'text' },
		{
			name: 'isActive',
			label: 'Status',
			type: 'boolean',
			trueLabel: 'Active',
			falseLabel: 'Inactive'
		}
	]
};
