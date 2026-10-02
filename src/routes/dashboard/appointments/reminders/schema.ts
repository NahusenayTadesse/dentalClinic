import { z } from 'zod/v4';

/** A reminder given for one appointment, and whether the patient said they would come. */
export const logReminder = z.object({
	appointmentId: z.coerce.number().int().positive(),
	confirmed: z.boolean().default(false)
});

export type LogReminder = z.infer<typeof logReminder>;
