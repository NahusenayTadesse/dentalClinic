import { z } from 'zod/v4';
import { CYCLE_KINDS, DEFAULT_SHELF_DAYS } from '$lib/sterilisation';

/*
 * The sterilisation log's forms. Numbers that may be left empty stay strings and the server reads
 * `''` as none (CLAUDE.md §13); the rules are `$lib/sterilisation.ts`'s, applied again on the
 * server.
 */

/** Recording a cycle as it comes out of the machine. */
export const newCycle = z.object({
	steriliserId: z.string().min(1, 'Choose the steriliser'),
	kind: z.enum(CYCLE_KINDS),
	ranOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose the day'),
	ranAt: z.string().regex(/^\d{2}:\d{2}$/, 'The time, like 09:30'),
	program: z.string().trim().max(60).optional(),
	temperatureC: z.string().regex(/^(\d{2,3}(\.\d)?)?$/, 'Degrees, like 134'),
	holdMinutes: z.string().regex(/^(\d{1,3})?$/, 'Minutes, like 4'),
	chemical: z.enum(['pass', 'fail', 'none']),
	biological: z.enum(['pending', 'none']),
	load: z.string().max(2000).optional(),
	shelfDays: z.coerce.number().int().min(1).max(365).default(DEFAULT_SHELF_DAYS),
	note: z.string().trim().max(1000).optional()
});

/** Packs opened for a patient at the chair. */
export const usePacksForm = z.object({
	patientId: z.coerce.number().int().positive('Choose the patient.'),
	codes: z.string().trim().min(1, 'Type or scan the code on each pack.').max(1000)
});

export type NewCycle = z.infer<typeof newCycle>;
export type UsePacksForm = z.infer<typeof usePacksForm>;
