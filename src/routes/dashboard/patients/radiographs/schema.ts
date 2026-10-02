import { z } from 'zod/v4';

/*
 * Filing an inbox image to a patient. The image is named, not uploaded — it is already on the
 * server. Optional choices stay strings and the server reads `''` as none (CLAUDE.md §13).
 */
export const fileImage = z.object({
	name: z.string().min(1).max(255),
	patientId: z.coerce.number().int().positive('Choose the patient.'),
	projection: z.string(),
	toothId: z.string().regex(/^(\d{2})?$/, 'The FDI number: two digits, like 36.'),
	takenOn: z
		.string()
		.regex(/^(\d{4}-\d{2}-\d{2})?$/, 'Choose a date')
		.optional(),
	description: z.string().trim().max(255).optional()
});

export type FileImage = z.infer<typeof fileImage>;
