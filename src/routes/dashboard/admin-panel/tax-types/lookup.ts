import type { LookupConfig } from '$lib/components/lookup/types';

/**
 * The monthly income-tax bands, in the "quick deduction" form the Ministry of Revenues publishes:
 * income up to the band's limit is taxed at its rate, less its deduction.
 *
 * The labels say the units, because the rate was once read as a fraction and the run taxed at a
 * hundred times the law: 15 means 15%. The band with no limit taxes everything above the others.
 * The arithmetic is `incomeTax` in `$lib/server/payrollMath.ts`.
 */
export const config: LookupConfig = {
	entity: 'Tax Band',
	plural: 'Tax Bands',
	fields: [
		{ name: 'name', label: 'Name', type: 'text' },
		{
			name: 'threshold',
			label: 'Up to (birr a month)',
			type: 'number',
			required: false,
			placeholder: 'Empty for the top band'
		},
		{ name: 'rate', label: 'Rate (%)', type: 'number' },
		{ name: 'deduction', label: 'Deduction (birr)', type: 'number' },
		{ name: 'status', label: 'Status', type: 'boolean' }
	]
};
