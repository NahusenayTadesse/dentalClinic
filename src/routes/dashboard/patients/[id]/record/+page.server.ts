import { error } from '@sveltejs/kit';

import { requirePermission } from '$lib/server/permissions';
import { livePatientId, logPatientView } from '$lib/server/patients';
import { fullRecord } from '$lib/server/patientRecord';
import { letterheadFor } from '$lib/server/branchScope';
import { clinicToday } from '$lib/clinicTime';
import type { PageServerLoad } from './$types';

/**
 * The patient's whole record on paper, for the patient who asks for it. Needs `patients.export` —
 * reading the chart is not the same as handing all of it over — and is logged as the whole record
 * printed, the evidence the request was answered. Rendered outside the dashboard layouts.
 */
export const load: PageServerLoad = async (event) => {
	requirePermission(event.locals, 'patients.export');
	const patientId = await livePatientId(event);
	const [record, branch] = await Promise.all([
		fullRecord(patientId),
		letterheadFor(event.locals.branch.active)
	]);
	if (!record) error(404, 'Patient not found');
	await logPatientView(patientId, 'fullRecord', event, { action: 'print' });
	return { record, branch, patientId, printedOn: clinicToday() };
};
