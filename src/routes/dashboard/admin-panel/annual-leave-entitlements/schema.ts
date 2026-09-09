import { z } from 'zod/v4';

// `toYears` empty means the bracket is open-ended — "this many years of service and up".
const bracket = {
	fromYears: z.coerce.number('Starting year of service is required').int().min(0).max(60),
	toYears: z.coerce.number().int().min(0).max(60).nullish(),
	// Half days are allowed, so this is no longer .int() — but nothing finer than a half is.
	days: z.coerce
		.number('Number of days is required')
		.min(0)
		.max(365)
		.refine((n) => n * 2 === Math.round(n * 2), 'Days must be a whole or half number'),
	description: z.string().max(255).optional(),
	status: z.boolean('Status is required').default(true)
};

const rangeIsOrdered = (data: { fromYears: number; toYears?: number | null }) =>
	data.toYears === null || data.toYears === undefined || data.toYears >= data.fromYears;

const rangeError = {
	message: 'The ending year cannot be before the starting year',
	path: ['toYears']
};

export const add = z.object(bracket).refine(rangeIsOrdered, rangeError);

export const edit = z
	.object({ id: z.coerce.number('Entitlement not found'), ...bracket })
	.refine(rangeIsOrdered, rangeError);

export type Add = z.infer<typeof add>;
export type Edit = z.infer<typeof edit>;
