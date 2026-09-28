import { error } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';

import { db } from '$lib/server/db';
import { patient } from '$lib/server/db/schema';
import { livePatient, livePatientId, logPatientView, patientFullName } from '$lib/server/patients';
import { originalTotal, planAdjustments, planDetail } from '$lib/server/treatmentPlans';
import { planTotals } from '$lib/treatmentPlanStatus';
import { clinicToday } from '$lib/clinicTime';
import type { PageServerLoad } from './$types';

/**
 * The printable quote. Rendered outside the dashboard and patient layouts (`+page@.svelte`), so it
 * reads the patient itself rather than from `parent()` — a layout reset skips the layouts' loads
 * as well as their markup. The route gate is still the chart's `patients.view`.
 *
 * Opening it is logged as a **print**: paper leaves the building, and the access log keeps that
 * apart from a view (`patient_access_log.action`).
 */
export const load: PageServerLoad = async (event) => {
	const patientId = await livePatientId(event);
	const planId = Number(event.params.planId);
	if (!Number.isInteger(planId) || planId <= 0) error(404, 'Plan not found');

	const [plan, [person]] = await Promise.all([
		planDetail(patientId, planId),
		db
			.select({ fullName: patientFullName, fileNo: patient.fileNo, phone: patient.phone })
			.from(patient)
			.where(and(eq(patient.id, patientId), livePatient()))
			.limit(1)
	]);
	if (!plan || !person) error(404, 'That plan is not on this patient’s record.');

	await logPatientView(patientId, 'treatmentPlan', event, { recordId: planId, action: 'print' });

	// A revised quote says so, and what it was first: the patient may be holding the first copy.
	const adjustments = await planAdjustments(planId);
	const revision = adjustments.length
		? {
				lastOn: adjustments[adjustments.length - 1].createdAt,
				originalTotal: originalTotal(planTotals(plan.lines).quoted, adjustments)
			}
		: null;

	return { plan, patient: person, revision, printedOn: clinicToday() };
};
