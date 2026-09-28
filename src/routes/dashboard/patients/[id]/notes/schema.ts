import { z } from 'zod/v4';

/*
 * The notes forms: only what the clinician writes and chooses. Who wrote it, when it was signed and
 * which note an amendment corrects are the server's (`server/clinicalNotes.ts`). Optional choices
 * stay strings and the server reads `''` as none (CLAUDE.md §13).
 */

const kind = z.enum(['examination', 'treatment', 'telephone', 'note']);
const body = z.string().trim().min(1, 'Write the note.').max(20_000);
const summary = z.string().trim().max(255).optional();

/** A new note. `sign` commits to it at once; otherwise it is saved as a draft. */
export const newNote = z.object({
	kind,
	summary,
	body,
	providerId: z.string(),
	appointmentId: z.string(),
	sign: z.boolean().default(true)
});

/** A draft's content, changed by its author. */
export const editNote = z.object({
	noteId: z.coerce.number().int().positive(),
	kind,
	summary,
	body,
	providerId: z.string(),
	appointmentId: z.string()
});

/** A correction to a signed note. */
export const amendNote = z.object({
	noteId: z.coerce.number().int().positive(),
	summary,
	body: z.string().trim().min(1, 'Write the correction.').max(20_000)
});

/** Signing or discarding a draft: which note. */
export const noteStep = z.object({ noteId: z.coerce.number().int().positive() });

export type NewNote = z.infer<typeof newNote>;
export type EditNote = z.infer<typeof editNote>;
export type AmendNote = z.infer<typeof amendNote>;
