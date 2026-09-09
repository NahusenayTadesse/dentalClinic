import { z } from 'zod/v4';

/**
 * Supply types are the categories on the supplies list (Machinery, Cleaning
 * Chemicals, …). Unlike most lookup tables this one has no `status` column —
 * `supply_types` only spreads `deletionFields` — so there is nothing to
 * activate or deactivate, only add, rename and delete.
 */
export const add = z.object({
	name: z
		.string('A name is required')
		.min(2, { message: 'Name must be at least 2 characters.' })
		.max(50, { message: 'Name cannot be more than 50 characters.' }),
	description: z.string().max(255, { message: 'Description is too long.' }).optional()
});

export const edit = add.extend({
	id: z.coerce.number().int().positive()
});

export type Add = z.infer<typeof add>;
export type Edit = z.infer<typeof edit>;
