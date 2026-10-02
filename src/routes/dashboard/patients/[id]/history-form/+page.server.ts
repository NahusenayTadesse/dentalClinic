import { error } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';

import { db } from '$lib/server/db';
import { patient } from '$lib/server/db/schema';
import {
	livePatient,
	livePatientId,
	logPatientView,
	patientFullName,
	recordedHistory
} from '$lib/server/patients';
import { letterheadFor } from '$lib/server/branchScope';
import { isoDate } from '$lib/server/db/dialect';
import { isLang } from '$lib/i18n/lang';
import { clinicToday } from '$lib/clinicTime';
import type { PageServerLoad } from './$types';

/**
 * The medical-history questionnaire on paper, for the patient to fill in and sign at the desk —
 * with what the chart already holds printed for them to check. Their answers are then entered on
 * the overview, and "I asked the medical history questions today" ticked.
 *
 * Rendered outside the dashboard layouts (`+page@.svelte`); the gate is the chart's
 * `patients.view`. Logged as a print: it carries the patient's allergies and medicines.
 */
export const load: PageServerLoad = async (event) => {
	const patientId = await livePatientId(event);
	const asked = event.url.searchParams.get('lang');
	const lang = isLang(asked) ? asked : event.locals.lang;

	const [[person], history, letterhead] = await Promise.all([
		db
			.select({
				fullName: patientFullName,
				fileNo: patient.fileNo,
				sex: patient.sex,
				birthDate: isoDate(patient.birthDate),
				phone: patient.phone
			})
			.from(patient)
			.where(and(eq(patient.id, patientId), livePatient()))
			.limit(1),
		recordedHistory(patientId),
		letterheadFor(event.locals.branch.active)
	]);
	if (!person) error(404, 'Patient not found');

	await logPatientView(patientId, 'summary', event, { action: 'print' });
	return { lang, patient: person, history, branch: letterhead, printedOn: clinicToday() };
};
