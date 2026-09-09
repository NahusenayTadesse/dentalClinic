import { z } from 'zod/v4';

export const add = z.object({
	name: z.string().min(1, 'Name is required'),
	phone: z.string().min(10, 'Phone is required').max(15),
	email: z.string().email(),
	description: z.string().optional(),
	subcity: z.coerce.string('Subcity is required'),
	street: z.string().optional(),
	kebele: z.string().optional(),
	buildingNumber: z.string().optional(),
	floor: z.string().nullable(),
	houseNumber: z.string().optional(),
	status: z.boolean('Status is required').default(true)
});

// To use this for a single row result

export const edit = z.object({
	addressId: z.coerce.string(),
	name: z.string().min(1, 'Name is required'),
	phone: z.string().min(10, 'Phone is required').max(15),
	email: z.email().optional(),
	description: z.string().optional(),
	subcity: z.coerce.string(),
	street: z.string().optional(),
	kebele: z.string().optional(),
	buildingNumber: z.string().optional(),
	floor: z.coerce.string().nullable(),
	houseNumber: z.coerce.string().optional(),
	status: z.boolean('Status is required')
});
export type Edit = z.infer<typeof edit>;
