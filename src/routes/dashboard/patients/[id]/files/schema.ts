import { z } from 'zod/v4';
import { ACCEPTED_FILE_TYPES, MAX_FILE_SIZE } from '$lib/zodschemas/appointmentSchema';

/*
 * Attaching a file: the file, what it is, and when it was made. The size and type are checked
 * again on the server (`server/files.ts`), which is the control; this is the courtesy. Optional
 * choices stay strings and the server reads `''` as none (CLAUDE.md §13).
 */

export const attach = z.object({
	file: z
		.instanceof(File, { message: 'Choose a file.' })
		.refine((f) => f.size > 0, 'Choose a file.')
		.refine((f) => f.size <= MAX_FILE_SIZE, 'That file is larger than 10MB.')
		.refine(
			(f) => ACCEPTED_FILE_TYPES.includes(f.type),
			'A photograph or scan (JPG, PNG, WebP, HEIC) or a PDF.'
		),
	kind: z.enum(['radiograph', 'photo', 'consent', 'referral', 'labResult', 'paperRecord', 'other']),
	/** For a radiograph: which projection. `''` is none, and anything else is refused by the server. */
	projection: z.string(),
	takenOn: z
		.string()
		.regex(/^(\d{4}-\d{2}-\d{2})?$/, 'Choose a date')
		.optional(),
	toothId: z.string().regex(/^(\d{2})?$/, 'The FDI number: two digits, like 36.'),
	description: z.string().trim().max(255).optional(),
	appointmentId: z.string()
});

/** Removing one: which. */
export const removeFile = z.object({ fileId: z.coerce.number().int().positive() });

export type Attach = z.infer<typeof attach>;
