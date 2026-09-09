import { z } from 'zod/v4';

export const add = z.object({
	name: z.string('Name of Payment Method is required').min(2).max(50),
	regionId: z.coerce.string('Region is required'),
	status: z.boolean('Status is required')
});

export const edit = z.object({
	id: z.coerce.string(),
	name: z.string('Name of Payment Method is required').min(2).max(50),
	regionId: z.coerce.string(),
	status: z.boolean('Status is required')
});
export type Edit = z.infer<typeof edit>;
