import { z } from 'zod';

/**
 * Mirrors the pay-component columns shared by `payrollEntries` and
 * `payrollAdjustments`. Each is entered as a plain magnitude and applied to
 * the matching payrollEntries column, signed by `adjustmentType` — left at 0
 * it's a no-op.
 */
export const adjustableFields = [
	'basicSalary',
	'overtimeAmount',
	'deductions',
	'commissionAmount',
	'bonusAmount',
	'allowances',
	'transportAllowance',
	'positionAllowance',
	'housingAllowance',
	'nonTaxableAllowance'
] as const;

export const adjust = z
	.object({
		id: z.number('Something went wrong').array().nonempty('You need to select at least one record'),
		adjustmentType: z.enum(['bonus', 'deduction'], 'Adjustment type is required'),
		amount: z.coerce.number().min(0).default(0),
		basicSalary: z.coerce.number().min(0).default(0),
		overtimeAmount: z.coerce.number().min(0).default(0),
		deductions: z.coerce.number().min(0).default(0),
		commissionAmount: z.coerce.number().min(0).default(0),
		bonusAmount: z.coerce.number().min(0).default(0),
		allowances: z.coerce.number().min(0).default(0),
		transportAllowance: z.coerce.number().min(0).default(0),
		positionAllowance: z.coerce.number().min(0).default(0),
		housingAllowance: z.coerce.number().min(0).default(0),
		nonTaxableAllowance: z.coerce.number().min(0).default(0),
		reason: z.string('Reason is required'),
		reciept: z.file('Bank Reciept is Required').max(10000000),
		bank: z.number('Bank is required')
	})
	.refine(
		(data) => data.amount + adjustableFields.reduce((sum, field) => sum + data[field], 0) > 0,
		{ message: 'Enter at least one amount to adjust', path: ['amount'] }
	);

export type Adjust = z.infer<typeof adjust>;

export const finalizePayroll = z.object({
	id: z.number('Something went wrong'),
	finalizedBy: z.number('Select the employee finalizing this payroll')
});

export type FinalizePayroll = z.infer<typeof finalizePayroll>;
