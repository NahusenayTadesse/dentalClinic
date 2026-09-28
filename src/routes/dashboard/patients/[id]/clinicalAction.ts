import type { RequestEvent } from '@sveltejs/kit';
import type { z } from 'zod/v4';
import type { Infer } from 'sveltekit-superforms';

import { patientAction } from '$lib/server/patientAction';
import { db } from '$lib/server/db';

/**
 * Who may write the clinical record — notes, prescriptions, consents, and files. Reading them is
 * the chart's `patients.view`; the same split the allergies and the dental chart already use.
 */
export const CLINICAL_PERMISSION = 'patients.clinical';

/** A transaction on the database, as `db.transaction` hands it over. */
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * A write on one of the clinical tabs: `patientAction` under `patients.clinical`. Shared by the
 * notes, prescriptions, files and consents tabs, which differ only in their schema and their write.
 */
export function clinicalAction<S extends z.ZodObject>(
	event: RequestEvent,
	schema: S,
	write: (
		tx: Tx,
		input: { patientId: number; data: Infer<S, 'zod4'> }
	) => Promise<string | { redirect: string; text: string }>
) {
	return patientAction(event, CLINICAL_PERMISSION, schema, write);
}
