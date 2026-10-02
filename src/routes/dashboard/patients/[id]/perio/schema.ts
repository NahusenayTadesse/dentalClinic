import { z } from 'zod/v4';
import { PERIO_LIMITS } from '$lib/perio';

/*
 * The periodontal chart's forms. The limits are `$lib/perio.ts`'s, so the form and the server's
 * `perioProblem` refuse the same readings. Optional choices stay strings and the server reads `''`
 * as none (CLAUDE.md §13).
 */

/** Starting an exam: who is probing, and at which visit. */
export const newExam = z.object({
	providerId: z.string(),
	appointmentId: z.string()
});

const grade = (limits: { min: number; max: number }) =>
	z.number().int().min(limits.min).max(limits.max).nullable();

const site = z.object({
	depth: grade(PERIO_LIMITS.depth),
	recession: grade(PERIO_LIMITS.recession),
	bleeding: z.boolean(),
	plaque: z.boolean()
});

/**
 * A draft's readings and notes. Posted as JSON (`dataType: 'json'`): 32 teeth of six sites each is
 * a structure, not a list of fields.
 */
export const saveExam = z.object({
	teeth: z
		.array(
			z.object({
				tooth: z.number().int(),
				missing: z.boolean(),
				mobility: grade(PERIO_LIMITS.mobility),
				furcation: grade(PERIO_LIMITS.furcation),
				sites: z.object({ DB: site, B: site, MB: site, DL: site, L: site, ML: site })
			})
		)
		.max(32),
	notes: z.string().max(5000)
});

/** A step with nothing to fill in: finishing or discarding a draft. */
export const examStep = z.object({});

export type NewExam = z.infer<typeof newExam>;
export type SaveExam = z.infer<typeof saveExam>;
