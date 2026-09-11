import type { LookupConfig } from '$lib/components/lookup/types';

/**
 * The laboratories the clinic sends work to.
 *
 * `typicalTurnaroundDays` is what the lab promises. What it delivers is the gap between `dueOn`
 * and `receivedOn` on `lab_case` — worth comparing before renewing anyone.
 */
export const config: LookupConfig = {
	entity: 'Dental Lab',
	plural: 'Dental Labs',
	fields: [
		{ name: 'name', label: 'Name', type: 'text' },
		{ name: 'phone', label: 'Phone', type: 'text', required: false },
		{ name: 'contactPerson', label: 'Contact Person', type: 'text', required: false },
		{ name: 'address', label: 'Address', type: 'text', required: false },
		{
			name: 'typicalTurnaroundDays',
			label: 'Turnaround (days)',
			type: 'number',
			required: false
		},
		{ name: 'notes', label: 'Notes', type: 'text', required: false },
		{ name: 'status', label: 'Status', type: 'boolean' }
	]
};
