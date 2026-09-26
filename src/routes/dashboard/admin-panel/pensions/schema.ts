import { z } from 'zod/v4';

/**
 * Only edits exist — see `lookup.ts`. The rate is a percentage of basic salary, and a pension
 * contribution above a fifth of pay is a typing mistake rather than a scheme.
 */
export const edit = z.object({
	id: z.coerce.number(),
	name: z.string('Name is required').min(2).max(100),
	rate: z.coerce
		.number('Rate is required')
		.min(0, 'A rate cannot be negative')
		.max(20, 'That is over 20% of basic salary — check the figure'),
	status: z.boolean('Status is required').default(true)
});
export type Edit = z.infer<typeof edit>;

/** `contentCrud` needs an add schema to build its unused add form; nothing posts to it. */
export const add = edit.omit({ id: true });
