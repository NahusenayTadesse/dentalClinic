import type { LookupConfig } from '@nahu/admin-kit/components/lookup/types.js';
import { PACKAGE_KINDS, PACKAGE_KIND_LABEL } from '$lib/packages';

/**
 * Treatment packages: a name, how it is sold, a price, and — for a prepaid package — how long it can
 * be used. The services in it are chosen in their own column (`+page.svelte`). The two kinds and
 * what each does at the desk are `$lib/packages.ts`'s.
 */
export const config: LookupConfig = {
	entity: 'Package',
	plural: 'Packages',
	fields: [
		{ name: 'name', label: 'Name', type: 'text', placeholder: 'Check-up and clean' },
		{
			name: 'kind',
			label: 'How it is sold',
			type: 'select',
			choices: PACKAGE_KINDS.map((k) => ({ value: k, name: PACKAGE_KIND_LABEL[k] }))
		},
		{ name: 'price', label: 'Price', type: 'money' },
		{
			name: 'validDays',
			label: 'Usable for (days)',
			type: 'number',
			required: false,
			placeholder: 'Prepaid only; empty for no limit'
		},
		{ name: 'description', label: 'Description', type: 'text', required: false },
		{ name: 'status', label: 'Status', type: 'boolean' }
	]
};
