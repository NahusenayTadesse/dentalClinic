import { z } from 'zod/v4';

const fields = {
	name: z.string('Name is required').min(2).max(50),
	/** Mirrors the `kind` enum on `contact_types`. Both change together or not at all. */
	kind: z.enum(['email', 'phone', 'username', 'url'], 'Kind is required'),
	linkPrefix: z.string().max(120).optional(),
	description: z.string().max(255).optional(),
	sortOrder: z.coerce.number().int().min(0).default(0),
	status: z.boolean('Status is required')
};

export const add = z.object(fields);

export const edit = z.object({ id: z.coerce.string(), ...fields });
