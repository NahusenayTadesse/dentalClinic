import { z } from 'zod/v4';

export const overtimeSchema = z.object({
	date: z.string().min(1, { message: 'Overtime date is required.' }),
	overtimeType: z.number('Overtime type is required.'),

	reason: z.string().max(255, { message: 'Description cannot exceed 255 characters.' }).optional(),

	hours: z.coerce.number('Hours is Required').int().positive()
});

// To use this schema for a form, you might extract the type:
export type InsertExpenseForm = z.infer<typeof overtimeSchema>;
