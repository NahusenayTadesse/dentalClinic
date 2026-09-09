import { z } from 'zod/v4';

export const add = z.object({
	name: z.string('Name of Payment Method is required').min(2).max(50),
	description: z.string('Description is required').min(2).max(100),
	category: z.coerce.number('Category is required'),

	status: z.boolean('Status is required')
});

export const edit = z.object({
	id: z.coerce.string(),
	name: z.string('Name of Payment Method is required').min(2).max(50),
	category: z.coerce.number('Category is required'),
	description: z.string('Description is required').min(2).max(100),
	status: z.boolean('Status is required')
});
export type Edit = z.infer<typeof edit>;
