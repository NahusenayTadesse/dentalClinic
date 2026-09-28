import type { RequestEvent } from '@sveltejs/kit';
import type { z } from 'zod/v4';
import type { Infer } from 'sveltekit-superforms';

import { patientAction } from '$lib/server/patientAction';
import { db } from '$lib/server/db';

/** Who may draw up, present and answer a plan. Reading one is the chart's `patients.view`. */
export const PLAN_PERMISSION = 'treatment_plans.manage';

/** A transaction on the database, as `db.transaction` hands it over. */
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** A treatment plan action: `patientAction` under the plans permission. */
export function planAction<S extends z.ZodObject>(
	event: RequestEvent,
	schema: S,
	write: (
		tx: Tx,
		input: { patientId: number; data: Infer<S, 'zod4'> }
	) => Promise<string | { redirect: string; text: string }>
) {
	return patientAction(event, PLAN_PERMISSION, schema, write);
}
