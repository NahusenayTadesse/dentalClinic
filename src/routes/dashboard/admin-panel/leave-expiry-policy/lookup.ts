import type { LookupConfig } from '@nahu/admin-kit/components/lookup/types.js';

/** How long an unspent leave grant lasts before the expiry job voids it (`leaveAccrual.ts`). */
export const config: LookupConfig = {
	entity: 'Expiry Policy',
	plural: 'Leave Expiry Policies',
	fields: [
		{ name: 'name', label: 'Name', type: 'text' },
		{ name: 'expiryYears', label: 'Expires after (years)', type: 'number' },
		{ name: 'description', label: 'Description', type: 'text', required: false, long: true },
		{ name: 'status', label: 'Status', type: 'boolean' }
	]
};
