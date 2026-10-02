import { error } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';

import { db } from '$lib/server/db';
import { patient } from '$lib/server/db/schema';
import { livePatient, livePatientId, logPatientView, patientFullName } from '$lib/server/patients';
import { consentWording } from '$lib/server/consentTemplates';
import { chartProcedures } from '$lib/server/procedures';
import { providerOptions } from '$lib/server/appointments';
import { letterheadFor } from '$lib/server/branchScope';
import { isLang } from '$lib/i18n/lang';
import { clinicToday } from '$lib/clinicTime';
import { fillConsent } from '$lib/consentForms';
import { whereLabel } from '$lib/teeth';
import type { PageServerLoad } from './$types';

/**
 * A consent form on paper, for the patient to sign: the clinic's wording for that kind of consent
 * with the patient, the treatment and the clinician filled in, under the letterhead of the branch
 * it is printed at. Rendered outside the dashboard and patient layouts (`+page@.svelte`), so it
 * reads the patient itself; the gate is still the chart's `patients.view`. Logged as a print of
 * the consents — paper leaves the building.
 *
 * The treatment and clinician come from the query string, and each is used only if it is this
 * patient's treatment or a clinician on the list: a link someone edits prints a blank line, not
 * another patient's procedure.
 */
export const load: PageServerLoad = async (event) => {
	const { url, locals } = event;
	const patientId = await livePatientId(event);
	const templateId = Number(url.searchParams.get('template'));
	if (!Number.isInteger(templateId) || templateId <= 0) error(404, 'Choose a consent form.');
	const asked = url.searchParams.get('lang');
	const lang = isLang(asked) ? asked : locals.lang;

	const [wording, [person], work, clinicians, letterhead] = await Promise.all([
		consentWording(templateId),
		db
			.select({ fullName: patientFullName, fileNo: patient.fileNo })
			.from(patient)
			.where(and(eq(patient.id, patientId), livePatient()))
			.limit(1),
		chartProcedures(patientId),
		providerOptions(),
		letterheadFor(locals.branch.active)
	]);
	if (!wording) error(404, 'That consent form is no longer in use.');
	if (!person) error(404, 'Patient not found');

	const treatment = work.find((w) => w.id === Number(url.searchParams.get('treatment')));
	const clinician = clinicians.find((c) => c.value === Number(url.searchParams.get('clinician')));

	await logPatientView(patientId, 'consent', event, { action: 'print' });

	return {
		lang,
		consentType: wording.consentType,
		body: fillConsent(lang === 'am' ? wording.bodyAm : wording.bodyEn, {
			patient: person.fullName,
			clinic: letterhead.name,
			treatment: treatment ? `${treatment.service ?? ''} ${whereLabel(treatment)}`.trim() : null,
			clinician: clinician?.name ?? null
		}),
		patient: person,
		clinician: clinician?.name ?? null,
		branch: letterhead,
		printedOn: clinicToday()
	};
};
