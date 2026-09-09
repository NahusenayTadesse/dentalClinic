import type { LookupConfig } from '$lib/components/lookup/types';

export const config: LookupConfig = {
	entity: 'Overtime Type',
	plural: 'Overtime Types',
	fields: [
		{ name: 'name', label: 'Name', type: 'text' },
		{ name: 'rate', label: 'Rate', type: 'number' },
		{ name: 'maxhours', label: 'Max Hours', type: 'number' },
		{ name: 'status', label: 'Status', type: 'boolean' }
	]
};
