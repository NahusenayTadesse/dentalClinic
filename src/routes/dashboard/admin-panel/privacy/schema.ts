import { z } from 'zod/v4';

/** How long a record is kept after a patient was last seen. */
export const retention = z.object({
	recordRetentionYears: z.coerce.number().int().min(1, 'At least a year').max(100)
});
