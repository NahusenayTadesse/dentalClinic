import { z } from 'zod/v4';

/** The clinic's billing settings — see `clinicSettings`. */
export const billingSettings = z.object({
	discountApprovalPercent: z.coerce
		.number()
		.min(0, 'Between 0 and 100.')
		.max(100, 'Between 0 and 100.')
});
