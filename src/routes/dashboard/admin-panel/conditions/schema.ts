import { z } from 'zod/v4';

const fields = {
	name: z.string('Name is required').min(2).max(160),
	category: z.string().max(80).optional(),
	isDentalRelated: z.boolean().default(false),
	hmisCode: z.string().max(16).optional(),
	icdCode: z.string().max(16).optional(),
	sortOrder: z.coerce.number().int().min(0).default(0),
	status: z.boolean('Status is required')
};

export const add = z.object(fields);

export const edit = z.object({ id: z.coerce.string(), ...fields });
