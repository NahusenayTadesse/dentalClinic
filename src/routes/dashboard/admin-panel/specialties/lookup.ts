import type { LookupConfig } from '@nahu/admin-kit/components/lookup/types.js';

/**
 * What a clinician is licensed as.
 *
 * Editable because the cadres on an Ethiopian licence are not the Western specialty list — what
 * the clinic records should match the wording on the document in the file.
 */
export const config: LookupConfig = {
	entity: 'Specialty',
	plural: 'Specialties',
	fields: [
		{ name: 'name', label: 'Name', type: 'text' },
		{ name: 'description', label: 'Description', type: 'text', required: false },
		{ name: 'sortOrder', label: 'Order', type: 'number', required: false },
		{ name: 'status', label: 'Status', type: 'boolean' }
	]
};
