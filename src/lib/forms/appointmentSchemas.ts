import { z } from 'zod';
import { APPOINTMENT_STATUSES } from '$lib/appointmentStatus';

/**
 * The appointment forms, shared by the day view, the list and the patient chart.
 *
 * Times are clinic-local `YYYY-MM-DD` and `HH:mm` strings on the way in (see `clinicTime.ts`); the
 * server turns them into an instant. A form never carries a `Date`, because a browser in another
 * timezone would turn nine o'clock into something else before it was posted.
 */

const blank = (value: unknown) => (value === '' || value === null ? undefined : value);
const optionalId = z.preprocess(blank, z.coerce.number().int().positive().optional());

const date = z.string('Pick a date').regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick a date');
const clock = z.string('Pick a time').regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Pick a time');
const duration = z.coerce
	.number('Give a duration')
	.int()
	.min(5, 'At least 5 minutes')
	.max(720, 'At most 12 hours');

export const bookAppointment = z
	.object({
		patientId: z.coerce.number('Choose the patient').int().positive('Choose the patient'),
		/**
		 * The patient is already here. Books the appointment for now, marked arrived — the walk-in is
		 * the ordinary case at many clinics, not the exception (see the note on `appointment.status`).
		 */
		walkIn: z.boolean().default(false),
		date: z.preprocess(blank, date.optional()),
		time: z.preprocess(blank, clock.optional()),
		durationMinutes: duration.default(30),
		appointmentTypeId: optionalId,
		providerId: optionalId,
		operatoryId: optionalId,
		note: z.preprocess(blank, z.string().trim().max(500).optional()),
		isNewPatient: z.boolean().default(false),
		isAsap: z.boolean().default(false),
		/**
		 * Booked from a treatment plan: the plan's agreed, unbooked work is reserved to this visit
		 * (`reservePlanWork`). The server re-reads which work that is; the id only says which plan.
		 */
		planId: optionalId
	})
	.superRefine((data, ctx) => {
		if (data.walkIn) return;
		if (!data.date) ctx.addIssue({ code: 'custom', path: ['date'], message: 'Pick a date' });
		if (!data.time) ctx.addIssue({ code: 'custom', path: ['time'], message: 'Pick a time' });
	});
export type BookAppointment = z.infer<typeof bookAppointment>;

export const moveAppointment = z.object({
	id: z.coerce.number().int().positive(),
	date,
	time: clock,
	durationMinutes: duration,
	providerId: optionalId,
	operatoryId: optionalId
});
export type MoveAppointment = z.infer<typeof moveAppointment>;

export const changeStatus = z.object({
	id: z.coerce.number().int().positive(),
	to: z.enum(APPOINTMENT_STATUSES)
});
export type ChangeStatus = z.infer<typeof changeStatus>;

/**
 * Completing a visit, with the work it records: planned procedures now done, and whole-mouth
 * services from the visit's type. Both lists may be empty — a visit can end with nothing charted,
 * and a receptionist without clinical rights closes it that way.
 */
export const completeVisit = z.object({
	id: z.coerce.number().int().positive(),
	procedureIds: z.array(z.coerce.number().int().positive()).default([]),
	serviceIds: z.array(z.coerce.number().int().positive()).default([])
});
export type CompleteVisit = z.infer<typeof completeVisit>;

export const cancelAppointment = z.object({
	id: z.coerce.number().int().positive(),
	/** Required: "why did this not happen" is the one question a cancellation must answer. */
	reason: z.string('Say why it was cancelled').trim().min(2, 'Say why it was cancelled').max(255)
});
export type CancelAppointment = z.infer<typeof cancelAppointment>;
