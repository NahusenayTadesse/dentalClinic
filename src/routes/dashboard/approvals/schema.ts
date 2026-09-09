import { z } from 'zod/v4';

export const settleSchema = z
	.object({
		ids: z.array(z.number('Nothing selected')).min(1, 'Select at least one record'),
		decision: z.enum(['approved', 'rejected']),
		reason: z.string().max(255).optional()
	})
	// A rejection without a reason leaves the requester guessing at what to change, so the
	// reason is required for that decision and ignored for the other.
	.refine((v) => v.decision !== 'rejected' || (v.reason?.trim().length ?? 0) > 0, {
		message: 'Say why this is being rejected — the requester sees this on the record.',
		path: ['reason']
	});

export type Settle = z.infer<typeof settleSchema>;
