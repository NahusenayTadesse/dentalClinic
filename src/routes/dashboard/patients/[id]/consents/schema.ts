import { z } from 'zod/v4';

/*
 * A consent: what was agreed to, how, when and by whom. The chosen witness, form and procedure are
 * checked to be real and this patient's on the server (`server/consents.ts`); the withdrawal date
 * is the server's too. Optional choices stay strings (CLAUDE.md §13).
 */

const fields = {
	consentType: z.enum([
		'treatment',
		'surgical',
		'anaesthetic',
		'radiograph',
		'photography',
		'dataSharing'
	]),
	method: z.enum(['written', 'verbal', 'electronic']),
	givenOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose the date it was given'),
	givenBy: z.string().trim().max(150).optional(),
	relationship: z.string().trim().max(50).optional(),
	witnessedBy: z.coerce.string().optional(),
	procedureId: z.coerce.string().optional(),
	documentFileId: z.coerce.string().optional(),
	note: z.string().max(2000).optional(),
	/** Filled in when consent is withdrawn; cleared, it stands again. */
	withdrawnReason: z.string().trim().max(255).optional()
};

export const addConsent = z.object(fields);
export const editConsent = z.object({ id: z.coerce.number(), ...fields });
