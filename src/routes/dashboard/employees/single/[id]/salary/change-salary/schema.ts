import { z } from 'zod/v4';

export const salaryChangeSchema = z.object({
	site: z.number('Site is Required').positive('Site is Required'),
	department: z.number('Department is Required').positive('Department is Required'),
	position: z.number('Position is Required').positive('Position is Required'),
	changeReason: z.string().optional(),
	housingAllowance: z.coerce
		.number('Housing Allowance is Required')
		.nonnegative('Housing Allowance can not be a negative number.'),
	positionAllowance: z.coerce
		.number('Position Allowance is Required')
		.nonnegative('Position Allowance can not be a negative number.'),
	nonTaxAllowance: z.coerce
		.number('Tax Allowance is Required')
		.nonnegative('Tax Allowance can not be a negative number.'),
	transportationAllowance: z.coerce
		.number('Transport Allowance is Required')
		.nonnegative('Transport Allowance can not be a negative number.'),

	amount: z.coerce
		.number('New Amount is Required')
		.positive({ message: 'Amount must be a positive number.' }),
	date: z.string().min(1, { message: 'Start date of new salary is required.' }),
	officeCommission: z.boolean('Office Commission is required').default(false),
	percentage: z.number('Percentage is required').default(0)
});

// To use this schema for a form, you might extract the type:
export type InsertExpenseForm = z.infer<typeof salaryChangeSchema>;
