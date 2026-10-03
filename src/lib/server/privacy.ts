/**
 * Keeping personal data no longer than needed: which patients have not been seen within the
 * clinic's retention period, for a person to review. The proclamation (No. 1321/2024) asks that
 * data be kept only as long as its purpose needs; a dental record's purpose outlives the last
 * filling by years, so the period is the clinic's setting (`clinic_settings.recordRetentionYears`).
 *
 * A patient was last seen on the latest of: an appointment, a bill, a procedure done, or — for
 * someone registered and never treated — their registration.
 *
 * Non-goals: deleting or anonymising anything. Whether a record past its period is erased, kept for
 * a dispute, or kept because the patient is a child is a person's decision with the record in front
 * of them; this only puts the list in front of them. Every branch's patients: retention is the
 * clinic's obligation, not a branch's.
 */
import { and, eq, inArray, max } from 'drizzle-orm';

import { db } from '$lib/server/db';
import { appointment, invoice, patient, procedures } from '$lib/server/db/schema';
import { notDeleted } from '$lib/server/softDelete';
import { livePatient, patientFullName } from '$lib/server/patients';
import { clinicDate, clinicToday } from '$lib/clinicTime';

/** The patients last seen before `years` ago, longest-silent first. */
export async function pastRetention(years: number, limit = 500) {
	const today = clinicToday();
	const cutoff = `${Number(today.slice(0, 4)) - years}${today.slice(4)}`;

	const [people, visits, bills, work] = await Promise.all([
		db
			.select({
				id: patient.id,
				name: patientFullName,
				fileNo: patient.fileNo,
				registered: patient.createdAt
			})
			.from(patient)
			.where(livePatient()),
		db
			.select({ id: appointment.patientId, last: max(appointment.startsAt) })
			.from(appointment)
			.where(
				and(
					notDeleted(appointment),
					inArray(appointment.status, ['completed', 'arrived', 'inChair'])
				)
			)
			.groupBy(appointment.patientId),
		db
			.select({ id: invoice.patientId, last: max(invoice.issuedOn) })
			.from(invoice)
			.where(notDeleted(invoice))
			.groupBy(invoice.patientId),
		db
			.select({ id: procedures.patientId, last: max(procedures.completedOn) })
			.from(procedures)
			.where(and(notDeleted(procedures), eq(procedures.status, 'completed')))
			.groupBy(procedures.patientId)
	]);

	// Each source's latest day per patient, as a clinic day.
	const latest = new Map<number, string>();
	const note = (id: number | null, when: Date | string | null) => {
		if (id === null || !when) return;
		const day = typeof when === 'string' ? when.slice(0, 10) : clinicDate(when);
		if (day > (latest.get(id) ?? '')) latest.set(id, day);
	};
	for (const r of [...visits, ...bills, ...work]) note(r.id, r.last);
	for (const p of people) note(p.id, p.registered);

	return people
		.map((p) => ({ id: p.id, name: p.name, fileNo: p.fileNo, lastSeen: latest.get(p.id) ?? null }))
		.filter((p) => p.lastSeen !== null && p.lastSeen < cutoff)
		.sort((a, b) => ((a.lastSeen ?? '') < (b.lastSeen ?? '') ? -1 : 1))
		.slice(0, limit);
}
