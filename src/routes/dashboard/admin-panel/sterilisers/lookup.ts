import type { LookupConfig } from '@nahu/admin-kit/components/lookup/types.js';

/**
 * The sterilisers — autoclaves and dry-heat ovens — at each branch. A cycle is recorded against
 * one, and numbered on from its last (`server/sterilisation.ts`). Retiring one (Inactive) takes it
 * out of the form and keeps its log.
 */
export const config: LookupConfig = {
	entity: 'Steriliser',
	plural: 'Sterilisers',
	fields: [
		{ name: 'name', label: 'Name', type: 'text', placeholder: 'Autoclave 1' },
		{
			name: 'kind',
			label: 'Kind',
			type: 'select',
			choices: [
				{ value: 'autoclaveB', name: 'Autoclave, class B (vacuum)' },
				{ value: 'autoclaveN', name: 'Autoclave, class N' },
				{ value: 'autoclaveS', name: 'Autoclave, class S' },
				{ value: 'dryHeat', name: 'Dry-heat oven' }
			]
		},
		{ name: 'serialNo', label: 'Serial number', type: 'text', required: false },
		{
			name: 'branchId',
			label: 'Branch',
			type: 'reference',
			options: 'branchList',
			display: 'branch',
			picker: 'select'
		},
		{ name: 'status', label: 'Status', type: 'boolean' }
	]
};
