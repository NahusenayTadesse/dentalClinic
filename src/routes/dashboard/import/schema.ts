import { z } from 'zod';
import { IMPORT_KINDS, hasDates } from '$lib/dataImport';

/** The largest file the import takes. Five thousand rows of patients is well under a megabyte. */
export const MAX_IMPORT_MB = 5;

/**
 * The import form: which list, the file, and the two questions only the person can answer.
 *
 * `calendar` keeps `''` as its empty value, so the select's empty choice parses to itself
 * (CLAUDE.md §13); it is required only for a list with dates (`hasDates`), where a wrong answer
 * would move every date by years — see `dateCell`.
 */
export const importSheet = z
	.object({
		kind: z.enum(IMPORT_KINDS),
		file: z
			.file('Choose the spreadsheet to import')
			.max(MAX_IMPORT_MB * 1024 * 1024, `The file is larger than ${MAX_IMPORT_MB} MB — split it`),
		calendar: z.enum(['', 'gregorian', 'ethiopian']).default(''),
		includeDuplicates: z.boolean().default(false)
	})
	.superRefine((data, ctx) => {
		if (hasDates(data.kind) && !data.calendar) {
			ctx.addIssue({
				code: 'custom',
				path: ['calendar'],
				message: 'Say which calendar the dates in the file are written in'
			});
		}
	});

export type ImportSheet = z.infer<typeof importSheet>;
