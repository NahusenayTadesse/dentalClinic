import { z } from 'zod/v4';

const fields = {
	name: z.string('Branch name is required').min(2).max(100),
	phone: z.string().max(20).optional(),
	openedOn: z.string().optional(),
	status: z.boolean('Status is required')
};

export const add = z.object(fields);

export const edit = z.object({ id: z.coerce.string(), ...fields });
