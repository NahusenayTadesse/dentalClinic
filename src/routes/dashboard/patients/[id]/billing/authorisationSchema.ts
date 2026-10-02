import { z } from 'zod/v4';

/**
 * A pre-authorisation's form, shared by the Billing tab's section and its server half
 * (`authorisations.server.ts`). Amounts are strings, as superforms needs for a box that can be left
 * empty (CLAUDE.md §13); the server turns them into numbers.
 */
const fields = {
	customerId: z.coerce.string().min(1, 'Choose the payer'),
	reference: z.string().trim().max(100).optional(),
	requestedAmount: z.coerce.string().optional(),
	approvedAmount: z.coerce.string().optional(),
	status: z.enum(['requested', 'approved', 'declined']).default('requested'),
	validUntil: z.string().optional(),
	note: z.string().trim().max(255).optional()
};

export const addAuthorisation = z.object(fields);
export const editAuthorisation = z.object({ id: z.coerce.number().int().positive(), ...fields });
export type EditAuthorisation = z.infer<typeof editAuthorisation>;
