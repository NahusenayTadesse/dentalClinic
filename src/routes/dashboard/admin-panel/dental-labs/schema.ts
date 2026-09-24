import { z } from 'zod/v4';

const fields = {
	name: z.string('Name is required').min(2).max(120),
	phone: z.string().max(20).optional(),
	contactPerson: z.string().max(100).optional(),
	address: z.string().max(255).optional(),
	typicalTurnaroundDays: z.coerce.number().int().min(0).max(365).optional(),
	notes: z.string().max(255).optional(),
	status: z.boolean('Status is required').default(true)
};

export const add = z.object(fields);

export const edit = z.object({ id: z.coerce.string(), ...fields });
