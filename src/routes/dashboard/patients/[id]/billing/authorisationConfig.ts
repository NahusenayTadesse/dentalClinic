import type { LookupConfig } from '@nahu/admin-kit/components/lookup/types.js';
import type { Messages } from '$lib/i18n/messages';

/** The pre-authorisations section's table and form, in the viewer's language. */
export const authorisationConfig = (m: Messages): LookupConfig => {
	const a = m.billing.authorisations;
	return {
		entity: a.entity,
		plural: a.plural,
		fields: [
			{
				name: 'customerId',
				label: a.payer,
				type: 'reference',
				picker: 'select'
			},
			{ name: 'reference', label: a.reference, type: 'text', required: false },
			{ name: 'requestedAmount', label: a.requested, type: 'money', required: false },
			{ name: 'approvedAmount', label: a.approved, type: 'money', required: false },
			{
				name: 'status',
				label: a.status,
				type: 'select',
				choices: [
					{ value: 'requested', name: a.requestedStatus },
					{ value: 'approved', name: a.approvedStatus },
					{ value: 'declined', name: a.declinedStatus }
				]
			},
			{ name: 'validUntil', label: a.validUntil, type: 'date', required: false },
			{ name: 'note', label: a.note, type: 'text', required: false }
		]
	};
};
