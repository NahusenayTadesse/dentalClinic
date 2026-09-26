import type { LookupConfig } from '$lib/components/lookup/types';

/**
 * The two pension contribution rates: the employee's share, taken from their pay, and the
 * employer's, paid by the clinic on top of it. Both are percentages of basic salary.
 *
 * `fixedRows`: there are always exactly these two, found by payroll through their `party`, so the
 * screen edits them and nothing else. `party` is shown but not editable — switching it would swap
 * which rate payroll takes from whom.
 */
export const config: LookupConfig = {
	entity: 'Pension Rate',
	plural: 'Pension Rates',
	fixedRows: true,
	fields: [
		{ name: 'name', label: 'Name', type: 'text' },
		{
			name: 'party',
			label: 'Paid by',
			type: 'select',
			inForm: false,
			choices: [
				{ value: 'employee', name: 'Employee — taken from pay' },
				{ value: 'employer', name: 'Employer — paid on top' }
			]
		},
		{ name: 'rate', label: 'Rate (%)', type: 'number' },
		{ name: 'status', label: 'Status', type: 'boolean' }
	]
};
