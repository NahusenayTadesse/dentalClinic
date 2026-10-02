import { z } from 'zod/v4';

/** The clinic's billing settings — see `clinicSettings`. */
export const billingSettings = z.object({
	discountApprovalPercent: z.coerce
		.number()
		.min(0, 'Between 0 and 100.')
		.max(100, 'Between 0 and 100.'),
	/** Ten digits, as the Ministry of Revenues issues them. Empty until the clinic enters it. */
	tin: z
		.string()
		.trim()
		.regex(/^(\d{10})?$/, 'A TIN is ten digits.')
		.optional(),
	vatRegistered: z.boolean().default(false),
	vatRate: z.coerce.number().min(0, 'Between 0 and 100.').max(100, 'Between 0 and 100.'),
	vatOnServices: z.boolean().default(false)
});
