import type { LookupConfig } from '@nahu/admin-kit/components/lookup/types.js';

/**
 * How many days of annual leave a year of service earns, in brackets of service years. The
 * accrual job (`leaveAccrual.ts`) reads these; a blank "to" year makes the bracket open-ended.
 */
export const config: LookupConfig = {
	entity: 'Entitlement',
	plural: 'Annual Leave Entitlements',
	fields: [
		{ name: 'fromYears', label: 'From year of service', type: 'number' },
		{
			name: 'toYears',
			label: 'To year of service',
			type: 'number',
			required: false,
			placeholder: 'Blank for “and above”'
		},
		{ name: 'days', label: 'Days a year', type: 'number' },
		{ name: 'description', label: 'Description', type: 'text', required: false, long: true },
		{ name: 'status', label: 'Status', type: 'boolean' }
	]
};
