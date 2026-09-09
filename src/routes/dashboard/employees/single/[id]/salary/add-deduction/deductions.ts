import { z } from 'zod/v4';

export const deductionSchema = z.object({
	deductionDate: z.string().min(1, { message: 'Deduction date is required.' }),

	type: z.string('Deduction Type is Required'),

	description: z
		.string()
		.max(255, { message: 'Description cannot exceed 255 characters.' })
		.optional(),

	amount: z.coerce
		.number('Amount is Required')
		.positive({ message: 'Total must be a positive number.' })
});

// To use this schema for a form, you might extract the type:
export type InsertExpenseForm = z.infer<typeof deductionSchema>;
