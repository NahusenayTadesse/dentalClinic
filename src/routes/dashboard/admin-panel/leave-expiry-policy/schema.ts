import { z } from 'zod/v4';

const policy = {
	name: z.string('Name of the policy is required').min(2).max(50),
	expiryYears: z.coerce.number('Number of years is required').int().min(1).max(20),
	description: z.string().max(255).optional(),
	status: z.boolean('Status is required').default(true)
};

export const add = z.object(policy);

export const edit = z.object({ id: z.coerce.number('Policy not found'), ...policy });

export type Add = z.infer<typeof add>;
export type Edit = z.infer<typeof edit>;
