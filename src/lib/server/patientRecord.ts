/**
 * A patient's whole record, gathered for the patient — the copy the Personal Data Protection
 * Proclamation (No. 1321/2024) entitles them to ask for, on paper or as a file they can take
 * elsewhere. Read only, and assembled from the readers each tab already uses, so the copy cannot
 * say something the chart does not.
 *
 * What it holds: who they are and how to reach them; their medical history; every appointment;
 * the dental chart; periodontal and orthodontic records; treatment plans; signed clinical notes
 * (drafts are not yet the record); prescriptions; consents; the list of files held (the files
 * themselves are handed over from the Files tab — a radiograph does not print on a page); lab work;
 * bills, payments and deposits; and who has opened their chart.
 *
 * Giving it out is logged in the access log as the whole record printed or exported
 * (`fullRecord`), which is the evidence an access request was answered and when.
 *
 * Non-goals: other people's data that happens to sit beside it — an employer's other employees on
 * a claim, a staff member's notes about the clinic — and erasure, which is a person's decision.
 */
import { and, desc, eq } from 'drizzle-orm';

import { db } from '$lib/server/db';
import { customers, patient, patientConsent } from '$lib/server/db/schema';
import { notDeleted } from '$lib/server/softDelete';
import { isoDate } from '$lib/server/db/dialect';
import { livePatient, patientFullName, recordedHistory } from '$lib/server/patients';
import { appointmentQuery } from '$lib/server/appointments';
import { chartProcedures } from '$lib/server/procedures';
import { perioExams } from '$lib/server/perio';
import { orthoCases } from '$lib/server/ortho';
import { patientPlans } from '$lib/server/treatmentPlans';
import { patientNotes } from '$lib/server/clinicalNotes';
import { patientPrescriptions } from '$lib/server/prescriptions';
import { patientFiles } from '$lib/server/patientFiles';
import { patientLabCases } from '$lib/server/labCases';
import { patientInvoices } from '$lib/server/billing';
import { patientDeposits } from '$lib/server/deposits';
import { patientAccessHistory } from '$lib/server/accessLog';
import { appointment } from '$lib/server/db/schema';

/** The whole record, or null when there is no such live patient. */
export async function fullRecord(patientId: number) {
	const [person] = await db
		.select({
			fileNo: patient.fileNo,
			fullName: patientFullName,
			sex: patient.sex,
			birthDate: isoDate(patient.birthDate),
			phone: patient.phone,
			altPhone: patient.altPhone,
			bloodType: patient.bloodType,
			medicalNotes: patient.medicalNotes,
			payer: customers.name,
			payerMemberNo: patient.payerMemberNo,
			registeredOn: patient.createdAt
		})
		.from(patient)
		.leftJoin(customers, eq(customers.id, patient.customerId))
		.where(and(eq(patient.id, patientId), livePatient()))
		.limit(1);
	if (!person) return null;

	const [
		history,
		appointments,
		chart,
		perio,
		ortho,
		plans,
		notes,
		prescriptions,
		consents,
		files,
		lab,
		bills,
		deposits,
		access
	] = await Promise.all([
		recordedHistory(patientId),
		appointmentQuery(eq(appointment.patientId, patientId)).orderBy(desc(appointment.startsAt)),
		chartProcedures(patientId),
		perioExams(patientId),
		orthoCases(patientId),
		patientPlans(patientId),
		patientNotes(patientId),
		patientPrescriptions(patientId),
		db
			.select({
				consentType: patientConsent.consentType,
				method: patientConsent.method,
				givenOn: isoDate(patientConsent.givenOn),
				givenBy: patientConsent.givenBy,
				withdrawnOn: isoDate(patientConsent.withdrawnOn),
				withdrawnReason: patientConsent.withdrawnReason
			})
			.from(patientConsent)
			.where(and(eq(patientConsent.patientId, patientId), notDeleted(patientConsent))),
		patientFiles(patientId),
		patientLabCases(patientId),
		patientInvoices(patientId),
		patientDeposits(patientId),
		patientAccessHistory(patientId)
	]);

	return {
		person,
		history,
		appointments: appointments.map((a) => ({
			startsAt: a.startsAt,
			status: a.status,
			provider: a.provider,
			note: a.note
		})),
		chart: chart.map((p) => ({
			service: p.service,
			status: p.status,
			toothId: p.toothId,
			surfaces: p.surfaces,
			toothRange: p.toothRange,
			completedOn: p.completedOn,
			provider: p.provider,
			note: p.note
		})),
		perio: perio.map((e) => ({
			examinedOn: e.examinedOn,
			finished: e.completedAt !== null,
			provider: e.provider,
			summary: e.summary,
			notes: e.notes
		})),
		ortho: ortho.map((c) => ({
			appliance: c.appliance,
			status: c.status,
			startedOn: c.startedOn,
			endedOn: c.endedOn,
			totalFee: c.totalFee,
			paid: c.paid,
			notes: c.notes
		})),
		plans,
		// Signed notes only: a draft is its author's until it is signed (`clinicalNotes.ts`).
		notes: notes.filter((n) => n.signedAt !== null),
		prescriptions,
		consents,
		files: files.map((f) => ({
			kind: f.kind,
			description: f.description,
			originalName: f.originalName,
			takenOn: f.takenOn,
			addedOn: f.createdAt
		})),
		lab,
		bills: bills.map((b) => ({
			number: b.invoiceNumber,
			issuedOn: b.issuedOn,
			status: b.status,
			total: b.total,
			owed: b.owed
		})),
		deposits: deposits.map((d) => ({
			receiptNumber: d.receiptNumber,
			amount: d.amount,
			left: d.left,
			note: d.note
		})),
		access: access.map((a) => ({
			at: a.viewedAt,
			by: a.user,
			recordType: a.recordType,
			action: a.action
		}))
	};
}

/** The record as `fullRecord` returns it. */
export type FullRecord = NonNullable<Awaited<ReturnType<typeof fullRecord>>>;
