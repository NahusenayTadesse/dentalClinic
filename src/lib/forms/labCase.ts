import { z } from 'zod/v4';

/*
 * The lab work forms. Every date a move sets is the server's (`server/labCases.ts`) except the one
 * only the person sending knows: when the laboratory promised it back. Optional choices stay
 * strings, and the server reads `''` as none (CLAUDE.md §13).
 */

const dueOn = z
	.string()
	.regex(/^(\d{4}-\d{2}-\d{2})?$/, 'Choose a date')
	.optional();

/** Sending work to a laboratory, from the patient's chart. */
export const newLabCase = z.object({
	labId: z.string().min(1, 'Choose the laboratory.'),
	procedureId: z.string(),
	serviceId: z.string(),
	providerId: z.string(),
	teeth: z.string().trim().max(64).optional(),
	shade: z.string().trim().max(20).optional(),
	labFee: z.coerce.number().min(0, 'A fee cannot be negative.').max(10_000_000).optional(),
	instructions: z.string().trim().max(2000).optional(),
	send: z.boolean().default(true),
	dueOn
});

/** Moving a case on — sent, received, fitted, back for a remake, cancelled. */
export const moveLabCase = z.object({
	caseId: z.coerce.number().int().positive(),
	to: z.enum(['sent', 'received', 'fitted', 'remake', 'cancelled']),
	dueOn
});

export type NewLabCase = z.infer<typeof newLabCase>;
export type MoveLabCase = z.infer<typeof moveLabCase>;
