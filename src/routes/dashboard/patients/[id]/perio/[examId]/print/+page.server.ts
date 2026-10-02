import { error } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';

import { db } from '$lib/server/db';
import { patient } from '$lib/server/db/schema';
import { livePatient, livePatientId, logPatientView, patientFullName } from '$lib/server/patients';
import { perioExamDetail } from '$lib/server/perio';
import type { PageServerLoad } from './$types';

/**
 * A periodontal exam on paper — for a referral to a periodontist, or the patient's own copy.
 * Rendered outside the dashboard and patient layouts (`+page@.svelte`), so it reads the patient
 * itself; the route gate is still the chart's `patients.view`. Logged as a **print**, as the quote
 * is: paper leaves the building.
 */
export const load: PageServerLoad = async (event) => {
	const patientId = await livePatientId(event);
	const examId = Number(event.params.examId);
	if (!Number.isInteger(examId) || examId <= 0) error(404, 'Exam not found');

	const [detail, [person]] = await Promise.all([
		perioExamDetail(patientId, examId),
		db
			.select({ fullName: patientFullName, fileNo: patient.fileNo })
			.from(patient)
			.where(and(eq(patient.id, patientId), livePatient()))
			.limit(1)
	]);
	if (!detail || !person) error(404, 'That exam is not on this patient’s record.');

	await logPatientView(patientId, 'perio', event, { recordId: examId, action: 'print' });
	return { ...detail, patient: person };
};
