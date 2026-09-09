import { z } from 'zod/v4';

export const add = z.object({
	name: z.string('Name of Tax Type is required').min(2).max(50),
	rate: z.number('Rate is required'),
	threshold: z.number('Threshold is required'),
	deduction: z.number('Deduction is required'),
	status: z.boolean('Status is required').default(true)
});

export const edit = z.object({
	id: z.number('Tax type not found'),
	name: z.string('Name of Tax Type is required').min(2).max(50),
	rate: z.number('Rate is required'),
	threshold: z.number('Threshold is required'),
	deduction: z.number('Deduction is required'),
	status: z.boolean('Status is required').default(true)
});
export type Edit = z.infer<typeof edit>;
