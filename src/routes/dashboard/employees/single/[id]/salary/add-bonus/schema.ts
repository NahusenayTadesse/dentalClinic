import { z } from 'zod/v4';


export const bonusSchema = z.object({
    bonusDate: z.string().min(1, { message: 'Deduction date is required.' }),


    description: z
        .string()
        .max(255, { message: 'Description cannot exceed 255 characters.' })
        .optional(),

    amount: z.coerce
        .number('Amount is Required')
        .positive({ message: 'Amount must be a positive number.' }),
  
});

// To use this schema for a form, you might extract the type:
export type InsertExpenseForm = z.infer<typeof deductionSchema>;
