import { z } from 'zod/v4';

export const penality = z.object({});

export type AddPen = z.infer<typeof penality>;

export const add = z.object({
	/**
	 * Every request row on the invoice, comma separated. A special request bills
	 * several months under one invoice number and is one document to the customer,
	 * so approving it has to move all of its rows together rather than leave the
	 * other months sitting in the pending queue.
	 */
	ids: z.string('Request Id is required').min(1, 'Request Id is required'),
	approvedBy: z.number('Approved by is required').optional(),
	rejectedReason: z.string('Rejected reason is required').optional(),
	status: z.enum(['rejected', 'approved'], 'Status is required').default('approved')
});

export type AddRequest = z.infer<typeof add>;
