import { z } from 'zod/v4';

/**
 * The clinic's account codes, posted as JSON (`dataType: 'json'`): one row a payment method,
 * expense type and fixed account. An empty code unmaps one.
 */
export const accountCodes = z.object({
	codes: z.array(z.object({ target: z.string().max(40), code: z.string().trim().max(30) })).max(500)
});

export type AccountCodes = z.infer<typeof accountCodes>;
