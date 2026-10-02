import { z } from 'zod/v4';

/** A call to a recalled patient: how it went, and anything worth writing down. */
export const logCall = z.object({
	recallId: z.coerce.number().int().positive(),
	outcome: z.enum(['noAnswer', 'callBack', 'declined', 'stopped']),
	note: z.string().trim().max(255).optional()
});

export type LogCall = z.infer<typeof logCall>;
