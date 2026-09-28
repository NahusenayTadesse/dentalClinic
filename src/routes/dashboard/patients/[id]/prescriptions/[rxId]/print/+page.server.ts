import { error } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';

import { db } from '$lib/server/db';
import { patient } from '$lib/server/db/schema';
import { requirePermission } from '$lib/server/permissions';
import { isoDate, yearsSince } from '$lib/server/db/dialect';
import { livePatient, livePatientId, logPatientView, patientFullName } from '$lib/server/patients';
import { prescriptionSheet } from '$lib/server/prescriptions';
import type { PageServerLoad } from './$types';

/**
 * A prescription on paper, as the Ethiopian prescription form lays it out: the institution, the
 * patient's name, sex, age, weight and card number, what it is for, each medicine with how to take
 * it, and the prescriber with their licence number.
 *
 * Outside the chart's layout, so it reads the patient itself. Printing is logged as a **print** —
 * a prescription on paper leaves the building. Reading needs the chart's `patients.view`, which
 * the route gate already asked.
 */
export const load: PageServerLoad = async (event) => {
	requirePermission(event.locals, 'patients.view');
	const patientId = await livePatientId(event);
	const id = Number(event.params.rxId);
	if (!Number.isInteger(id) || id <= 0) error(404, 'Prescription not found');

	const sheet = await prescriptionSheet(patientId, id);
	if (!sheet) error(404, 'That prescription is not on this patient’s record.');

	const [person] = await db
		.select({
			fullName: patientFullName,
			fileNo: patient.fileNo,
			sex: patient.sex,
			birthDate: isoDate(patient.birthDate),
			birthDateEstimated: patient.birthDateEstimated,
			age: yearsSince(patient.birthDate)
		})
		.from(patient)
		.where(and(eq(patient.id, patientId), livePatient()))
		.limit(1);
	if (!person) error(404, 'Patient not found');

	await logPatientView(patientId, 'prescription', event, { recordId: id, action: 'print' });

	return {
		sheet,
		patient: { ...person, age: person.age === null ? null : Number(person.age) },
		branch: {
			name: sheet.branchName,
			address: sheet.branchAddress,
			phone: sheet.branchPhone
		}
	};
};
