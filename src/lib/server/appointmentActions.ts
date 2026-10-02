/**
 * The five things that change an appointment, as form actions any page can spread in.
 *
 *     export const actions = { ...appointmentActions };
 *
 * The day view, the appointment list and the patient chart all book, move, cancel and change the
 * status of appointments. Written once so the three cannot disagree about what is allowed — which
 * is the job this repo keeps relearning (CLAUDE.md §2).
 *
 * Every one of them:
 *
 *   - requires `appointments.book` in the action, whatever page it is posted to (§9) — the patient
 *     chart is gated by `patients.view`, and reading a chart does not make you a booker
 *   - finds the appointment **within the working branch** (`branchFilter`), so an id from another
 *     branch matches nothing (§15)
 *   - checks the move against `appointmentStatus.ts`, the same table the buttons are drawn from
 *   - writes and audits in one transaction (§11)
 */
import type { RequestEvent } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { message, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';

import { db } from '$lib/server/db';
import { appointment, patient } from '$lib/server/db/schema';
import { insertReturningId } from '@nahu/admin-kit/server/db/insert.js';
import { recordAudit } from '$lib/server/audit';
import { hasPermission, requirePermission } from '$lib/server/permissions';
import { WriteRefused } from '$lib/server/childCrud';
import { recordVisitWork, releaseBookedWork } from '$lib/server/procedures';
import { reservePlanWork } from '$lib/server/treatmentPlans';
import { recallAfterVisit, recallOnBooking, recallReleased } from '$lib/server/recalls';
import { formatEthiopianDate } from '$lib/global.svelte';
import { branchFilter } from '$lib/server/branchScope';
import { notDeleted } from '$lib/server/softDelete';
import { livePatient } from '$lib/server/patients';
import { bookingProblems, sanePeriod } from '$lib/server/appointments';
import {
	STATUS_LABEL,
	canMove,
	isAppointmentStatus,
	isMovable,
	type AppointmentStatus
} from '$lib/appointmentStatus';
import { fromClinic } from '$lib/clinicTime';
import {
	bookAppointment,
	cancelAppointment,
	changeStatus,
	completeVisit,
	moveAppointment
} from '$lib/forms/appointmentSchemas';

/** The permission every appointment write needs. */
export const BOOK_PERMISSION = 'appointments.book';

const invalid = { type: 'error' as const, text: 'Please check the form for errors' };
const failed = { type: 'error' as const, text: 'Could not save. Please try again.' };

/** The appointment `id` names, if it is at the working branch and not deleted. */
async function findHere(
	tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
	event: RequestEvent,
	id: number
) {
	const [row] = await tx
		.select()
		.from(appointment)
		.where(
			and(
				eq(appointment.id, id),
				notDeleted(appointment),
				branchFilter(appointment.branchId, event.locals.branch)
			)
		)
		.limit(1);
	return row ?? null;
}

/** Now, rounded down to five minutes — a walk-in's start, drawn on the grid where people expect. */
function nowRounded(): Date {
	const step = 5 * 60_000;
	return new Date(Math.floor(Date.now() / step) * step);
}

/**
 * The timestamps a move into `to` stamps. Only ever set the first time: re-marking a patient
 * arrived must not reset how long they have been waiting.
 */
function stampsFor(
	to: AppointmentStatus,
	row: typeof appointment.$inferSelect,
	now: Date
): Partial<typeof appointment.$inferInsert> {
	switch (to) {
		case 'confirmed':
			return { confirmedAt: row.confirmedAt ?? now };
		case 'arrived':
			return { arrivedAt: row.arrivedAt ?? now };
		case 'inChair':
			return { arrivedAt: row.arrivedAt ?? now, seatedAt: row.seatedAt ?? now };
		case 'completed':
			return { arrivedAt: row.arrivedAt ?? now, dismissedAt: row.dismissedAt ?? now };
		// Undoing a mistaken arrival: the arrival did not happen, so its time goes too.
		case 'scheduled':
			return { arrivedAt: null };
		default:
			return {};
	}
}

export const appointmentActions = {
	bookAppointment: async (event: RequestEvent) => {
		requirePermission(event.locals, BOOK_PERMISSION);
		const form = await superValidate(event.request, zod4(bookAppointment));
		if (!form.valid) return message(form, invalid, { status: 400 });

		const branchId = event.locals.branch.active;
		if (branchId === null) {
			return message(
				form,
				{
					type: 'error',
					text: 'Choose a branch in the top bar first — an appointment is at one branch.'
				},
				{ status: 400 }
			);
		}

		const data = form.data;
		/*
		 * Only a walk-in starts now. A booking without a date and time is refused rather than quietly
		 * placed at the current moment, which is what this did while the date picker was dropping
		 * the date — the appointment saved, just on the wrong day.
		 */
		if (!data.walkIn && (!data.date || !data.time)) {
			return message(form, { type: 'error', text: 'Pick a date and a time.' }, { status: 400 });
		}
		const startsAt =
			data.walkIn || !data.date || !data.time ? nowRounded() : fromClinic(data.date, data.time);
		const durationMinutes = sanePeriod(data.durationMinutes);

		try {
			const result = await db.transaction(async (tx) => {
				const [owner] = await tx
					.select({ id: patient.id })
					.from(patient)
					.where(and(eq(patient.id, data.patientId), livePatient()))
					.limit(1);
				if (!owner)
					return {
						problems: ['That patient no longer exists, or was merged into another record.']
					};

				const problems = await bookingProblems(tx, {
					branchId,
					startsAt,
					durationMinutes,
					operatoryId: data.operatoryId ?? null,
					providerId: data.providerId ?? null
				});
				if (problems.length) return { problems };

				const now = new Date();
				const id = await insertReturningId(tx, appointment, {
					patientId: data.patientId,
					branchId,
					startsAt,
					durationMinutes,
					appointmentTypeId: data.appointmentTypeId ?? null,
					providerId: data.providerId ?? null,
					operatoryId: data.operatoryId ?? null,
					note: data.note ?? null,
					isNewPatient: data.isNewPatient,
					isAsap: data.isAsap,
					status: data.walkIn ? 'arrived' : 'scheduled',
					arrivedAt: data.walkIn ? now : null,
					createdBy: event.locals.user?.id
				});
				await recordAudit(tx, event, {
					table: 'appointment',
					recordId: id,
					action: 'create',
					detail: data.walkIn ? { walkIn: true } : undefined
				});
				// A due recall for this kind of visit is answered by this booking (`server/recalls.ts`).
				await recallOnBooking(tx, event.locals.user?.id, {
					id,
					patientId: data.patientId,
					appointmentTypeId: data.appointmentTypeId ?? null,
					branchId,
					startsAt
				});
				// Booked from a treatment plan: the agreed work is this visit's to do.
				const reserved = data.planId
					? await reservePlanWork(tx, event, {
							patientId: data.patientId,
							planId: data.planId,
							appointmentId: id
						})
					: 0;
				return { problems: [], reserved };
			});

			if (result.problems.length) {
				return message(form, { type: 'error', text: result.problems.join(' ') }, { status: 409 });
			}
			const booked = data.walkIn ? 'Walk-in added and marked arrived' : 'Appointment booked';
			const reserved = 'reserved' in result ? result.reserved : 0;
			return message(form, {
				type: 'success',
				text: reserved
					? `${booked} · ${reserved} planned ${reserved === 1 ? 'procedure' : 'procedures'} booked for it`
					: booked
			});
		} catch (err: unknown) {
			console.error('[appointments] book failed:', err);
			return message(form, failed, { status: 500 });
		}
	},

	changeAppointmentStatus: async (event: RequestEvent) => {
		requirePermission(event.locals, BOOK_PERMISSION);
		const form = await superValidate(event.request, zod4(changeStatus));
		if (!form.valid) return message(form, invalid, { status: 400 });

		const { id, to } = form.data;

		try {
			const outcome = await db.transaction(async (tx) => {
				const row = await findHere(tx, event, id);
				if (!row) return 'missing' as const;
				if (!isAppointmentStatus(row.status) || !canMove(row.status, to)) return 'refused' as const;
				// Cancelling needs a reason and completing records the visit's work, so each has its
				// own action; a plain status change to either would skip what the other exists for.
				if (to === 'cancelled' || to === 'completed') return 'refused' as const;

				const values = {
					status: to,
					...stampsFor(to, row, new Date()),
					updatedBy: event.locals.user?.id
				};
				await tx.update(appointment).set(values).where(eq(appointment.id, id));
				await recordAudit(tx, event, {
					table: 'appointment',
					recordId: id,
					action: 'update',
					before: row,
					after: values
				});
				// A missed visit leaves the patient still due: the recall it held is open again.
				if (to === 'noShow') {
					await recallReleased(tx, event.locals.user?.id, id);
					await releaseBookedWork(tx, event, id);
				}
				return 'saved' as const;
			});

			if (outcome === 'missing') {
				return message(
					form,
					{ type: 'error', text: 'That appointment no longer exists here.' },
					{ status: 404 }
				);
			}
			if (outcome === 'refused') {
				return message(
					form,
					{
						type: 'error',
						text: `It cannot be marked “${STATUS_LABEL[to].label}” from where it is now.`
					},
					{ status: 409 }
				);
			}
			return message(form, {
				type: 'success',
				text: `Marked ${STATUS_LABEL[to].label.toLowerCase()}`
			});
		} catch (err: unknown) {
			console.error('[appointments] status failed:', err);
			return message(form, failed, { status: 500 });
		}
	},

	/**
	 * Finishing a visit and recording what was done at it, as one transaction: the appointment
	 * completed, planned work marked done, the type's usual services added — or none of it.
	 *
	 * Completing needs `appointments.book`, as every status change does. Recording work also needs
	 * `patients.clinical`, the permission the dental chart's own writes need: whoever may close a
	 * visit at the desk may not thereby write a patient's clinical record.
	 */
	completeVisit: async (event: RequestEvent) => {
		requirePermission(event.locals, BOOK_PERMISSION);
		const form = await superValidate(event.request, zod4(completeVisit));
		if (!form.valid) return message(form, invalid, { status: 400 });

		const { id, procedureIds, serviceIds } = form.data;
		if (
			(procedureIds.length || serviceIds.length) &&
			!hasPermission(event.locals, 'patients.clinical')
		) {
			return message(
				form,
				{
					type: 'error',
					text: 'Recording the work needs clinical access. Complete the visit without it, or ask the dentist.'
				},
				{ status: 403 }
			);
		}

		try {
			const outcome = await db.transaction(async (tx) => {
				const row = await findHere(tx, event, id);
				if (!row) return { kind: 'missing' as const };
				if (!isAppointmentStatus(row.status) || !canMove(row.status, 'completed')) {
					return { kind: 'refused' as const };
				}

				const values = {
					status: 'completed' as const,
					...stampsFor('completed', row, new Date()),
					updatedBy: event.locals.user?.id
				};
				await tx.update(appointment).set(values).where(eq(appointment.id, id));
				await recordAudit(tx, event, {
					table: 'appointment',
					recordId: id,
					action: 'update',
					before: row,
					after: values
				});

				const recorded = await recordVisitWork(tx, event, row, { procedureIds, serviceIds });
				const nextRecall = await recallAfterVisit(tx, event.locals.user?.id, row);
				return { kind: 'saved' as const, recorded, nextRecall };
			});

			if (outcome.kind === 'missing') {
				return message(
					form,
					{ type: 'error', text: 'That appointment no longer exists here.' },
					{ status: 404 }
				);
			}
			if (outcome.kind === 'refused') {
				return message(
					form,
					{ type: 'error', text: 'Only a visit that has started can be completed.' },
					{ status: 409 }
				);
			}
			const work =
				outcome.recorded === 0
					? ''
					: ` · ${outcome.recorded} ${outcome.recorded === 1 ? 'procedure' : 'procedures'} recorded`;
			const recall = outcome.nextRecall
				? ` · next due ${formatEthiopianDate(new Date(outcome.nextRecall))}`
				: '';
			return message(form, { type: 'success', text: `Visit completed${work}${recall}` });
		} catch (err: unknown) {
			// Thrown inside the transaction, so the completion rolled back with the work.
			if (err instanceof WriteRefused) {
				return message(form, { type: 'error', text: err.message }, { status: 400 });
			}
			console.error('[appointments] complete failed:', err);
			return message(form, failed, { status: 500 });
		}
	},

	cancelAppointment: async (event: RequestEvent) => {
		requirePermission(event.locals, BOOK_PERMISSION);
		const form = await superValidate(event.request, zod4(cancelAppointment));
		if (!form.valid) return message(form, invalid, { status: 400 });

		try {
			const outcome = await db.transaction(async (tx) => {
				const row = await findHere(tx, event, form.data.id);
				if (!row) return 'missing' as const;
				if (!isAppointmentStatus(row.status) || !canMove(row.status, 'cancelled')) {
					return 'refused' as const;
				}

				const values = {
					status: 'cancelled' as const,
					cancelReason: form.data.reason,
					cancelledAt: new Date(),
					cancelledBy: event.locals.user?.id ?? null,
					updatedBy: event.locals.user?.id
				};
				await tx.update(appointment).set(values).where(eq(appointment.id, row.id));
				await recordAudit(tx, event, {
					table: 'appointment',
					recordId: row.id,
					action: 'update',
					before: row,
					after: values
				});
				await recallReleased(tx, event.locals.user?.id, row.id);
				await releaseBookedWork(tx, event, row.id);
				return 'saved' as const;
			});

			if (outcome === 'missing') {
				return message(
					form,
					{ type: 'error', text: 'That appointment no longer exists here.' },
					{ status: 404 }
				);
			}
			if (outcome === 'refused') {
				return message(
					form,
					{ type: 'error', text: 'A visit that has started cannot be cancelled.' },
					{ status: 409 }
				);
			}
			return message(form, { type: 'success', text: 'Appointment cancelled' });
		} catch (err: unknown) {
			console.error('[appointments] cancel failed:', err);
			return message(form, failed, { status: 500 });
		}
	},

	moveAppointment: async (event: RequestEvent) => {
		requirePermission(event.locals, BOOK_PERMISSION);
		const form = await superValidate(event.request, zod4(moveAppointment));
		if (!form.valid) return message(form, invalid, { status: 400 });

		const data = form.data;
		const startsAt = fromClinic(data.date, data.time);
		const durationMinutes = sanePeriod(data.durationMinutes);

		try {
			const result = await db.transaction(async (tx) => {
				const row = await findHere(tx, event, data.id);
				if (!row)
					return { status: 404 as const, problems: ['That appointment no longer exists here.'] };
				if (!isAppointmentStatus(row.status) || !isMovable(row.status)) {
					return {
						status: 409 as const,
						problems: [
							'Only an appointment that has not started can be moved. Book a new one instead.'
						]
					};
				}

				const problems = await bookingProblems(tx, {
					// Moved within its own branch: a move to another branch is a new booking there.
					branchId: row.branchId ?? event.locals.branch.active ?? 0,
					startsAt,
					durationMinutes,
					operatoryId: data.operatoryId ?? null,
					providerId: data.providerId ?? null,
					excludeId: row.id
				});
				if (problems.length) return { status: 409 as const, problems };

				const values = {
					startsAt,
					durationMinutes,
					operatoryId: data.operatoryId ?? null,
					providerId: data.providerId ?? null,
					updatedBy: event.locals.user?.id
				};
				await tx.update(appointment).set(values).where(eq(appointment.id, row.id));
				await recordAudit(tx, event, {
					table: 'appointment',
					recordId: row.id,
					action: 'update',
					before: row,
					after: values
				});
				// `status` is only read when there are problems.
				return { status: 409 as const, problems: [] };
			});

			if (result.problems.length) {
				return message(
					form,
					{ type: 'error', text: result.problems.join(' ') },
					{ status: result.status }
				);
			}
			return message(form, { type: 'success', text: 'Appointment moved' });
		} catch (err: unknown) {
			console.error('[appointments] move failed:', err);
			return message(form, failed, { status: 500 });
		}
	}
};

/** The empty forms the five actions post, for a load to hand its page. */
export async function appointmentForms(
	prefill: {
		patientId?: number;
		appointmentTypeId?: number;
		durationMinutes?: number;
		planId?: number;
		note?: string;
	} = {}
) {
	const [book, move, status, cancel, complete] = await Promise.all([
		superValidate(
			{
				patientId: prefill.patientId,
				appointmentTypeId: prefill.appointmentTypeId,
				durationMinutes: prefill.durationMinutes ?? 30,
				planId: prefill.planId,
				note: prefill.note,
				walkIn: false,
				isNewPatient: false,
				isAsap: false
			},
			zod4(bookAppointment),
			{ errors: false }
		),
		superValidate(zod4(moveAppointment)),
		superValidate(zod4(changeStatus)),
		superValidate(zod4(cancelAppointment)),
		superValidate(zod4(completeVisit))
	]);
	return { book, move, status, cancel, complete };
}
