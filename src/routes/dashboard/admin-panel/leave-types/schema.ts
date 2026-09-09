import { z } from 'zod/v4';

export const add = z.object({
	name: z.string('Name of Leave Type is required').min(2).max(50),
	// Half days are allowed, so this is no longer .int() — but nothing finer than a half is.
	maxDays: z.coerce
		.number('Maximum number of days is required')
		.min(0)
		.max(365)
		.refine((n) => n * 2 === Math.round(n * 2), 'Days must be a whole or half number'),
	deductsBalance: z.boolean('This field is required').default(false),
	description: z.string('Description is required').max(255).optional(),
	status: z.boolean('Status is required').default(true)
});

export const edit = z.object({
	id: z.coerce.number('Leave type not found'),
	name: z.string('Name of Leave Type is required').min(2).max(50),
	// Half days are allowed, so this is no longer .int() — but nothing finer than a half is.
	maxDays: z.coerce
		.number('Maximum number of days is required')
		.min(0)
		.max(365)
		.refine((n) => n * 2 === Math.round(n * 2), 'Days must be a whole or half number'),
	deductsBalance: z.boolean('This field is required').default(false),
	description: z.string('Description is required').max(255).optional(),
	status: z.boolean('Status is required').default(true)
});

export type Add = z.infer<typeof add>;
export type Edit = z.infer<typeof edit>;
