import { z } from 'zod/v4';
import { MAX_FILE_SIZE, ACCEPTED_FILE_TYPES } from '$lib/zodschemas/appointmentSchema';
import type { paymentMethods } from '$lib/server/db/schema';

/**
 * Zod schema for inserting a new expense record.
 * This corresponds to the 'expenses' table.
 */
export const insertExpenseSchema = z.object({
	expenseDate: z.string().min(1, { message: 'Expense date is required.' }),

	type: z.coerce
		.number('Expense Type is Required')
		.int()
		.positive({ message: 'Type ID must be positive.' }),
	bank: z.coerce.number('Payment Method is Required').int().positive(),

	description: z
		.string()
		.max(255, { message: 'Description cannot exceed 255 characters.' })
		.optional(),

	total: z.coerce
		.number('Amount is Required')
		.positive({ message: 'Total must be a positive number.' }),
	reciept: z.file('Please upload a valid image (JPG, PNG, WebP, HEIC/HEIF) or PDF.').max(10000000),

	/** Set by the user when the expense would take the account below zero. */
	acknowledgeOverdraft: z.boolean().default(false)
});

// To use this schema for a form, you might extract the type:
export type InsertExpenseForm = z.infer<typeof insertExpenseSchema>;
