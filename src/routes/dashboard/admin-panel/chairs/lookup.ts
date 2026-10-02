import type { LookupConfig } from '@nahu/admin-kit/components/lookup/types.js';

/**
 * Dental chairs — `operatory` in the schema.
 *
 * The appointment day view is drawn as one column per active chair at the branch being worked at,
 * so a branch with no chairs here has an empty diary. `Order` is the left-to-right order of those
 * columns. Retiring a chair (Inactive) removes its column without touching appointments booked into
 * it.
 */
export const config: LookupConfig = {
	entity: 'Chair',
	plural: 'Chairs',
	fields: [
		{ name: 'name', label: 'Name', type: 'text', placeholder: 'Chair 1, Surgery A…' },
		{
			name: 'branchId',
			label: 'Branch',
			type: 'reference',
			options: 'branchList',
			display: 'branch',
			picker: 'select'
		},
		{ name: 'sortOrder', label: 'Order', type: 'number', required: false },
		{ name: 'status', label: 'Status', type: 'boolean' }
	]
};
