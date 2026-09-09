import { z } from 'zod/v4';

export const bulkAdd = z.object({
	ids: z.array(z.number('No Employee Selected')),
	date: z.string().min(1, { message: 'Deduction date is required.' }),
	overtimeType: z.number('Overtime type is required.'),

	reason: z.string().max(255, { message: 'Description cannot exceed 255 characters.' }).optional(),

	hours: z.coerce.number('Hours is Required').int().positive()
});
export type BulkAdd = z.infer<typeof bulkAdd>;

export const add = z.object({
	staffId: z.number('Employee  not found'),
	date: z.string().min(1, { message: 'Deduction date is required.' }),
	overtimeType: z.number('Overtime type is required.'),

	reason: z.string().max(255, { message: 'Description cannot exceed 255 characters.' }).optional(),

	hours: z.coerce.number('Hours is Required').int().positive()
});
export type Add = z.infer<typeof add>;

export const edit = z.object({
	id: z.number('Overtime not found'),
	staffId: z.number('Employee  not found'),
	date: z.string().min(1, { message: 'Deduction date is required.' }),
	overtimeType: z.number('Overtime type is required.'),

	reason: z.string().max(255, { message: 'Description cannot exceed 255 characters.' }).optional(),

	hours: z.coerce.number('Hours is Required').int().positive()
});
export type Edit = z.infer<typeof edit>;

export const deleteOvertime = z.object({
	id: z.number('Overtime  not found')
});
export type Delete = z.infer<typeof deleteOvertime>;
