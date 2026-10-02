import { requirePermission } from '$lib/server/permissions';
import { patientAccessHistory } from '$lib/server/accessLog';
import type { PageServerLoad } from './$types';

/**
 * Who has opened this patient's chart, every part of it, newest first — the answer to a patient
 * asking who has seen their record.
 *
 * The route gate is the chart's `patients.view`, which is far too wide for this: reading the log
 * is `audit_logs.view`, checked here because a path rule cannot tell this tab from the others (§9).
 * Reading the log is not itself logged — it is not the patient's clinical record.
 */
export const load: PageServerLoad = async (event) => {
	requirePermission(event.locals, 'audit_logs.view');
	const { patient } = await event.parent();
	const views = await patientAccessHistory(patient.id);
	return { views };
};
