import { z } from 'zod/v4';

/*
 * The treatment plan forms. Each is only what the person chooses — which work, what wording, what
 * answer. Totals, statuses and dates are worked out by `server/treatmentPlans.ts`, never posted.
 *
 * Optional choices stay strings and the server reads `''` as none (CLAUDE.md §13): a schema that
 * turned `''` into `undefined` would loop against the select writing `''` back.
 */

const workIds = z
	.array(z.coerce.number().int().positive())
	.min(1, 'Choose at least one piece of work.');

/** A new plan, from planned work on the chart. */
export const newPlan = z.object({
	procedureIds: workIds,
	providerId: z.coerce.string().nullable().optional(),
	note: z.string().max(1000).optional()
});

/**
 * Why a presented quote is being changed. Optional here because a draft needs none; the server is
 * what requires it once the plan has been presented (`server/treatmentPlans.ts`).
 */
const reason = z.string().max(255).optional();

/** More planned work onto a draft, or onto a presented quote not yet answered. */
export const addWork = z.object({ procedureIds: workIds, reason });

/** A draft line's wording, quantity and price. */
export const editLine = z.object({
	itemId: z.coerce.number().int().positive(),
	description: z.string().trim().min(1, 'Say what this line is.').max(255),
	quantity: z.coerce.number().positive('At least one.').max(100),
	unitPrice: z.coerce.number().min(0, 'A price cannot be negative.').max(10_000_000),
	reason
});

/** One line, for removing it — with a reason, once the quote has been presented. */
export const removeLineForm = z.object({ itemId: z.coerce.number().int().positive(), reason });

/** Presenting a draft: how long the quote stands. Empty means the default. */
export const present = z.object({
	validUntil: z
		.string()
		.regex(/^(\d{4}-\d{2}-\d{2})?$/, 'Choose a date')
		.optional()
});

/**
 * The patient's answer, line by line. Posted as JSON (`dataType: 'json'`): a list of decisions does
 * not survive a trip through form fields, and `pending` is allowed here so the server — not the
 * form — is what says an answer is incomplete.
 */
export const answer = z.object({
	decisions: z.array(
		z.object({
			itemId: z.number().int().positive(),
			decision: z.enum(['pending', 'accepted', 'declined'])
		})
	),
	declineReason: z.string().max(255).optional()
});

/** A step with nothing to fill in: completing a plan, discarding a draft. */
export const confirmOnly = z.object({});

export type NewPlan = z.infer<typeof newPlan>;
export type AddWork = z.infer<typeof addWork>;
export type EditLine = z.infer<typeof editLine>;
export type RemoveLine = z.infer<typeof removeLineForm>;
export type Present = z.infer<typeof present>;
export type Answer = z.infer<typeof answer>;
