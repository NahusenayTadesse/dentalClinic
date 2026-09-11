import { z } from 'zod/v4';

const fields = {
	name: z.string('Name is required').min(2).max(80),
	description: z.string().max(255).optional(),
	sortOrder: z.coerce.number().int().min(0).default(0),
	status: z.boolean('Status is required')
};

export const add = z.object(fields);

export const edit = z.object({ id: z.coerce.string(), ...fields });
