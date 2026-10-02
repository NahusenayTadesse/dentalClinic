import { z } from 'zod/v4';

const fields = {
	name: z.string('Name of the category is required').min(2).max(50),
	description: z.string().max(255).optional(),
	status: z.boolean('Status is required').default(true)
};

export const add = z.object(fields);

export const edit = z.object({ id: z.coerce.string(), ...fields });
