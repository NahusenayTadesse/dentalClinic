import { z } from 'zod/v4';

export const penality = z.object({});

export type AddPen = z.infer<typeof penality>;

export const add = z.object({
	/**
	 * Every request row on the invoice, comma separated — a special request bills
	 * several months under one invoice number and reopens as one document.
	 */
	ids: z.string('Request Id is required').min(1, 'Request Id is required'),
	requestedBy: z.number('Requestor is required'),
	/** Only offered for a single-month invoice; see the action for why. */
	month: z.string('Month is required').optional(),
	requestDate: z.string('Request date is required'),
	rejectedReason: z.string('Rejected reason is required').optional(),
	status: z.enum(['pending'], 'Status is required').default('pending')
});

export type AddRequest = z.infer<typeof add>;
