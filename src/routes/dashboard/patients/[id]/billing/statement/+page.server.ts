import { error } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';

import { db } from '$lib/server/db';
import { patient } from '$lib/server/db/schema';
import { requirePermission } from '$lib/server/permissions';
import { livePatient, livePatientId, logPatientView, patientFullName } from '$lib/server/patients';
import { letterheadFor } from '$lib/server/branchScope';
import { patientStatement } from '$lib/server/statements';
import { addClinicDays, clinicToday, isIsoDate } from '$lib/clinicTime';
import { BILLING_PERMISSION } from '../billingAction';
import type { PageServerLoad } from './$types';

/**
 * A patient's account statement, on paper: the last three months unless a range is asked for.
 * Rendered outside the dashboard layouts (`+page@.svelte`). Money is `billing.invoice`'s, as on the
 * billing tab; printing it is logged as a print of the patient's billing.
 */
export const load: PageServerLoad = async (event) => {
	requirePermission(event.locals, BILLING_PERMISSION);
	const patientId = await livePatientId(event);
	const today = clinicToday();
	const askedTo = event.url.searchParams.get('to');
	const askedFrom = event.url.searchParams.get('from');
	const to = isIsoDate(askedTo) && askedTo <= today ? askedTo : today;
	const from = isIsoDate(askedFrom) && askedFrom <= to ? askedFrom : addClinicDays(to, -90);

	const [[person], statement, branch] = await Promise.all([
		db
			.select({ fullName: patientFullName, fileNo: patient.fileNo, phone: patient.phone })
			.from(patient)
			.where(and(eq(patient.id, patientId), livePatient()))
			.limit(1),
		patientStatement(patientId, from, to),
		letterheadFor(event.locals.branch.active)
	]);
	if (!person) error(404, 'Patient not found');
	await logPatientView(patientId, 'invoice', event, { action: 'print' });
	return { patient: person, from, to, statement, branch, printedOn: today };
};
