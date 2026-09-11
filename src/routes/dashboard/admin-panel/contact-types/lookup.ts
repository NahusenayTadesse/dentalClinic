import type { LookupConfig } from '$lib/components/lookup/types';

/**
 * The channels a patient can be reached on.
 *
 * `kind` and `linkPrefix` are the two fields that make adding a channel useful rather than
 * merely possible: together they tell the UI how to validate the value and how to turn it into
 * a link. Adding Viber here is a row, not a deploy.
 */
export const config: LookupConfig = {
	entity: 'Contact Type',
	plural: 'Contact Types',
	fields: [
		{ name: 'name', label: 'Name', type: 'text' },
		{
			name: 'kind',
			label: 'Kind',
			type: 'select',
			choices: [
				{ value: 'username', name: 'Username or handle' },
				{ value: 'phone', name: 'Phone number' },
				{ value: 'email', name: 'Email address' },
				{ value: 'url', name: 'Full web address' }
			]
		},
		{
			name: 'linkPrefix',
			label: 'Link Prefix',
			type: 'text',
			required: false,
			placeholder: 'https://t.me/'
		},
		{ name: 'description', label: 'Description', type: 'text', required: false },
		{ name: 'sortOrder', label: 'Order', type: 'number', required: false },
		{ name: 'status', label: 'Status', type: 'boolean' }
	]
};
