import { z } from 'zod/v4';

const fields = {
	name: z.string('Name is required').min(2).max(80),
	defaultMinutes: z.coerce.number().int().min(5).max(480).default(30),
	/** Hex, so the day view can use it directly without parsing anything at render time. */
	colour: z
		.string()
		.regex(/^#[0-9a-fA-F]{6}$/, 'Colour must be a hex value like #2563eb')
		.optional()
		.or(z.literal('')),
	description: z.string().max(255).optional(),
	sortOrder: z.coerce.number().int().min(0).default(0),
	status: z.boolean('Status is required').default(true)
};

export const add = z.object(fields);

export const edit = z.object({ id: z.coerce.string(), ...fields });
