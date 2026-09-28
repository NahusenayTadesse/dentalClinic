import { z } from 'zod/v4';

/** Which record to fold into the chart that is open. Shared by the action and its dialog. */
export const mergeForm = z.object({
	duplicateId: z.coerce.number().int().positive('Choose the record.')
});
