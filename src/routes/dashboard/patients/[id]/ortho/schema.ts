import { z } from 'zod/v4';
import { APPLIANCES, ORTHO_STATUSES } from '$lib/orthoPlan';

/*
 * The orthodontic forms. Optional choices stay strings and the server reads `''` as none
 * (CLAUDE.md §13). The plan's rules are `$lib/orthoPlan.ts`'s, applied again on the server.
 */

/** Opening a case, with its payment plan. */
export const newCase = z.object({
	providerId: z.string(),
	appliance: z.enum(APPLIANCES),
	startedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose the day treatment starts'),
	plannedMonths: z.coerce.number().int().min(1).max(72).default(18),
	totalFee: z.coerce.number().positive('Give the fee for the whole treatment'),
	deposit: z.coerce.number().min(0).default(0),
	instalments: z.coerce.number().int().min(0).max(60).default(12),
	notes: z.string().trim().max(2000).optional()
});

/** An adjustment visit. */
export const newVisit = z.object({
	visitedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose the day'),
	work: z.string().trim().min(2, 'Say what was done').max(255),
	nextInWeeks: z.string().regex(/^(\d{1,2})?$/, 'Weeks, like 4'),
	providerId: z.string(),
	appointmentId: z.string(),
	note: z.string().trim().max(2000).optional()
});

/** Moving a case on. */
export const moveCase = z.object({ status: z.enum(ORTHO_STATUSES) });

/** A step with nothing to fill in: billing what is due. */
export const orthoStep = z.object({});

export type NewCase = z.infer<typeof newCase>;
export type NewVisit = z.infer<typeof newVisit>;
