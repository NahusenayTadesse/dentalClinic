import { z } from 'zod/v4';

export const bulkAdd = z.object({
	ids: z.array(z.number('No Employee Selected')),
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
export type BulkAdd = z.infer<typeof bulkAdd>;

export const add = z.object({
	staffId: z.number('Employee  not found'),
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
export type Add = z.infer<typeof add>;

export const edit = z.object({
	id: z.number('Overtime not found'),
	staffId: z.number('Employee  not found'),
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
export type Edit = z.infer<typeof edit>;

export const deleteOvertime = z.object({
	id: z.number('Overtime  not found')
});
export type Delete = z.infer<typeof deleteOvertime>;
