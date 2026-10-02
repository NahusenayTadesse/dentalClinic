import { and, asc, eq, gte, inArray, isNull, lte, or } from 'drizzle-orm';

import { db } from '$lib/server/db';
import { appointmentType, patient, recall } from '$lib/server/db/schema';
import { insertReturningId } from '@nahu/admin-kit/server/db/insert.js';
import { notDeleted } from '$lib/server/softDelete';
import { refuseUnless } from '$lib/server/childCrud';
import { branchFilter, type BranchContext } from '$lib/server/branchScope';
import { livePatient, patientFullName } from '$lib/server/patients';
import { addClinicMonths, clinicDate, clinicToday } from '$lib/clinicTime';

/**
 * Bringing patients back: a recall is a patient due to come in again, with no appointment yet.
 *
 * **Kept by the diary, not by a scheduled job.** The roadmap suggested the `job_run` pattern for
 * this; it turned out not to be needed, because everything that changes a recall is something that
 * happens to an appointment, and each of those is already a write in `appointmentActions.ts`:
 *
 *   - **a visit is completed** — any recall it answers is `completed`, and if its type recalls
 *     (`appointment_type.recallIntervalMonths`: a check-up at six months) the next one is created,
 *     due that many months after the visit (`recallAfterVisit`)
 *   - **an appointment is booked** — a due recall of the same type for that patient is `booked`
 *     against it (`recallOnBooking`)
 *   - **it is cancelled or missed** — the recall it held is `due` again (`recallReleased`)
 *
 * Each runs in the appointment's own transaction, so a recall is never out of step with the diary,
 * and there is no job that could stop firing and leave the list quietly wrong.
 *
 * **The desk's side** is the list and the phone: who is due, who has been tried and how often
 * (`logRecallCall`), and who said no. A declined recall is kept, so a patient who declines is not
 * rung a fourth time.
 *
 * Not audited: a recall is an invitation, not the record of care, and `recall` is not on the list
 * (CLAUDE.md §11). It carries `updatedBy`, which answers "who marked this".
 *
 * Non-goal: sending anything. The schema note says why — the channel is a phone call for most.
 */

/** A transaction on the database, as `db.transaction` hands it over. */
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Reader = Tx | typeof db;

/** Who works the recall list: whoever books appointments, since a recall is answered by one. */
export const RECALL_PERMISSION = 'appointments.book';

/** The attempts after which the list stops suggesting another call. */
export const MAX_ATTEMPTS = 3;

/** An appointment, as the recall hooks need it. */
type Visit = {
	id: number;
	patientId: number;
	appointmentTypeId: number | null;
	branchId: number | null;
	startsAt: Date;
};

/** The same type, or — for a recall with no type — any. */
function sameType(appointmentTypeId: number | null) {
	return appointmentTypeId === null
		? undefined
		: or(eq(recall.appointmentTypeId, appointmentTypeId), isNull(recall.appointmentTypeId));
}

/**
 * A visit was completed: close what it answered, and start the next recall if its type calls for
 * one. Returns the new recall's due date, or null.
 */
export async function recallAfterVisit(
	tx: Tx,
	userId: string | undefined,
	visit: Visit
): Promise<string | null> {
	const visitOn = clinicDate(visit.startsAt);

	// What this visit answers: a recall booked against it, or one still due for the same kind of
	// visit — a patient who came for a check-up without being called still had it.
	await tx
		.update(recall)
		.set({ status: 'completed', scheduledAppointmentId: visit.id, updatedBy: userId })
		.where(
			and(
				eq(recall.patientId, visit.patientId),
				notDeleted(recall),
				or(
					eq(recall.scheduledAppointmentId, visit.id),
					and(inArray(recall.status, ['due', 'booked']), sameType(visit.appointmentTypeId))
				)
			)
		);

	if (visit.appointmentTypeId === null) return null;
	const [type] = await tx
		.select({ months: appointmentType.recallIntervalMonths })
		.from(appointmentType)
		.where(eq(appointmentType.id, visit.appointmentTypeId))
		.limit(1);
	if (!type?.months) return null;

	const dueOn = addClinicMonths(visitOn, type.months);
	await insertReturningId(tx, recall, {
		patientId: visit.patientId,
		appointmentTypeId: visit.appointmentTypeId,
		branchId: visit.branchId ?? undefined,
		dueOn,
		lastVisitOn: visitOn,
		status: 'due',
		createdBy: userId
	});
	return dueOn;
}

/** An appointment was booked: the patient's due recall for that kind of visit is answered by it. */
export async function recallOnBooking(tx: Tx, userId: string | undefined, visit: Visit) {
	const [open] = await tx
		.select({ id: recall.id })
		.from(recall)
		.where(
			and(
				eq(recall.patientId, visit.patientId),
				eq(recall.status, 'due'),
				notDeleted(recall),
				sameType(visit.appointmentTypeId)
			)
		)
		.orderBy(asc(recall.dueOn))
		.limit(1);
	if (!open) return;
	await tx
		.update(recall)
		.set({ status: 'booked', scheduledAppointmentId: visit.id, updatedBy: userId })
		.where(eq(recall.id, open.id));
}

/** The appointment a recall was booked against was cancelled or missed: it is due again. */
export async function recallReleased(tx: Tx, userId: string | undefined, appointmentId: number) {
	await tx
		.update(recall)
		.set({ status: 'due', scheduledAppointmentId: null, updatedBy: userId })
		.where(and(eq(recall.scheduledAppointmentId, appointmentId), eq(recall.status, 'booked')));
}

/**
 * The recall list at this branch: everyone due by `until` who has not booked, the longest overdue
 * first, with how often they have been tried. Declined and stopped recalls are left off; so is a
 * patient merged into another record, whose recall moved with them.
 */
export async function dueRecalls(
	branch: Pick<BranchContext, 'active'>,
	until: string,
	reader: Reader = db
) {
	const rows = await reader
		.select({
			id: recall.id,
			patientId: recall.patientId,
			patient: patientFullName,
			fileNo: patient.fileNo,
			phone: patient.phone,
			appointmentTypeId: recall.appointmentTypeId,
			visit: appointmentType.name,
			dueOn: recall.dueOn,
			lastVisitOn: recall.lastVisitOn,
			attempts: recall.contactAttempts,
			lastContactedAt: recall.lastContactedAt,
			note: recall.note
		})
		.from(recall)
		.innerJoin(patient, and(eq(patient.id, recall.patientId), livePatient()))
		.leftJoin(appointmentType, eq(appointmentType.id, recall.appointmentTypeId))
		.where(
			and(
				eq(recall.status, 'due'),
				lte(recall.dueOn, until),
				notDeleted(recall),
				branchFilter(recall.branchId, branch)
			)
		)
		.orderBy(asc(recall.dueOn), asc(recall.id));
	const today = clinicToday();
	return rows.map((row) => ({
		...row,
		overdue: row.dueOn < today,
		lastContactedOn: row.lastContactedAt ? clinicDate(row.lastContactedAt) : null
	}));
}

/** One recall, locked, checked to be live and still waiting. */
async function openRecall(tx: Tx, recallId: number) {
	const [row] = await tx
		.select()
		.from(recall)
		.where(and(eq(recall.id, recallId), notDeleted(recall)))
		.limit(1)
		.for('update');
	refuseUnless(Boolean(row), 'That recall no longer exists.');
	refuseUnless(row.status === 'due', 'That recall is no longer waiting — it was booked or closed.');
	return row;
}

/**
 * A call to a recalled patient: counted, dated, and noted. `declined` closes it — the patient said
 * no — and `stopped` ends it for the clinic's reasons: moved away, died, treated elsewhere.
 */
export async function logRecallCall(
	tx: Tx,
	userId: string | undefined,
	recallId: number,
	{
		outcome,
		note
	}: { outcome: 'noAnswer' | 'callBack' | 'declined' | 'stopped'; note: string | null }
) {
	const row = await openRecall(tx, recallId);
	const counted = outcome === 'noAnswer' || outcome === 'callBack' || outcome === 'declined';
	await tx
		.update(recall)
		.set({
			...(counted ? { contactAttempts: row.contactAttempts + 1, lastContactedAt: new Date() } : {}),
			...(outcome === 'declined' ? { status: 'declined' as const } : {}),
			...(outcome === 'stopped' ? { status: 'stopped' as const } : {}),
			note: note?.trim() ? note.trim().slice(0, 255) : row.note,
			updatedBy: userId
		})
		.where(eq(recall.id, recallId));
}

/** Year-to-date figures for the list's header: how many came back, and how many were due. */
export async function recallSummary(branch: Pick<BranchContext, 'active'>, until: string) {
	const rows = await db
		.select({ status: recall.status, dueOn: recall.dueOn })
		.from(recall)
		.where(
			and(notDeleted(recall), branchFilter(recall.branchId, branch), lte(recall.dueOn, until))
		);
	const today = clinicToday();
	return {
		dueNow: rows.filter((r) => r.status === 'due' && r.dueOn <= until).length,
		overdue: rows.filter((r) => r.status === 'due' && r.dueOn < today).length,
		booked: rows.filter((r) => r.status === 'booked').length,
		// Of the recalls that fell due and are settled one way or the other, the share that came back.
		cameBack: (() => {
			const settled = rows.filter((r) => r.status === 'completed' || r.status === 'declined');
			return settled.length
				? Math.round(
						(100 * settled.filter((r) => r.status === 'completed').length) / settled.length
					)
				: null;
		})()
	};
}

/**
 * The patient's open recall, for the chart: the earliest still due or booked, with what it is for.
 * Null when nothing will bring them back — which is itself worth seeing on a chart.
 */
export async function patientRecall(patientId: number, reader: Reader = db) {
	const [row] = await reader
		.select({
			id: recall.id,
			dueOn: recall.dueOn,
			status: recall.status,
			visit: appointmentType.name,
			attempts: recall.contactAttempts
		})
		.from(recall)
		.leftJoin(appointmentType, eq(appointmentType.id, recall.appointmentTypeId))
		.where(
			and(
				eq(recall.patientId, patientId),
				inArray(recall.status, ['due', 'booked']),
				notDeleted(recall)
			)
		)
		.orderBy(asc(recall.dueOn))
		.limit(1);
	return row ?? null;
}

/**
 * Every recall at this branch that fell due between two clinic days (inclusive), whatever became of
 * it — the clinical report's ledger of who was asked back and who came. A recall still `due` after
 * its date is the missed one.
 */
export async function recallsDueBetween(
	from: string,
	to: string,
	branch: Pick<BranchContext, 'active'>
) {
	return db
		.select({
			id: recall.id,
			patientId: recall.patientId,
			patient: patientFullName,
			phone: patient.phone,
			visit: appointmentType.name,
			dueOn: recall.dueOn,
			status: recall.status,
			attempts: recall.contactAttempts
		})
		.from(recall)
		.innerJoin(patient, eq(patient.id, recall.patientId))
		.leftJoin(appointmentType, eq(appointmentType.id, recall.appointmentTypeId))
		.where(
			and(
				gte(recall.dueOn, from),
				lte(recall.dueOn, to),
				notDeleted(recall),
				branchFilter(recall.branchId, branch)
			)
		)
		.orderBy(asc(recall.dueOn), asc(recall.id));
}
