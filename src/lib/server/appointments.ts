/**
 * The diary's rules: what may be booked where, and what a day looks like.
 *
 * Three screens write appointments — the day view, the list and the patient chart — and they must
 * refuse the same things. The database cannot: there is no constraint for "no two live bookings on
 * one chair at overlapping times" (see the note on `appointment`), so this module is where that
 * rule lives, and every write calls `bookingProblems` before it saves.
 *
 * What it checks, in the order a receptionist would want to hear about it:
 *
 *   1. **the clinic is open** that day at that branch (`clinic_closure`, honouring `isActive`)
 *   2. **the chair is free** — no live appointment on it overlaps
 *   3. **the dentist is free** — no live appointment for them overlaps, at any branch
 *   4. **the chair belongs to this branch**, so a cookie or a stale form cannot book branch A's chair
 *      from branch B
 *
 * Live means not cancelled and not a no-show (`isLive`): a cancelled slot is free again.
 *
 * Non-goals: working hours and leave. `staff_schedule` and `leave` say when a dentist is off, but
 * both are often blank, and a hard refusal built on missing data blocks real bookings. They are a
 * warning the booker can override instead — `server/providerHours.ts`, checked by the actions after
 * this.
 */
import {
	and,
	desc,
	eq,
	gt,
	inArray,
	isNull,
	lt,
	lte,
	gte,
	ne,
	notInArray,
	or,
	sql,
	type SQL
} from 'drizzle-orm';
import { alias } from 'drizzle-orm/mysql-core';

import { db } from '$lib/server/db';
import {
	appointment,
	appointmentType,
	clinicClosure,
	employee,
	operatory,
	patient,
	provider
} from '$lib/server/db/schema';
import { notDeleted } from '$lib/server/softDelete';
import { WriteRefused } from '$lib/server/childCrud';
import { addMinutes, concatWith, storedInstant } from '$lib/server/db/dialect';
import { patientFullName } from '$lib/server/patients';
import { clinicClock, clinicDate } from '$lib/clinicTime';

/** The database or a transaction on it. */
type Reader = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

/** The longest appointment the overlap check looks back for. A day in the chair is plenty. */
const MAX_MINUTES = 12 * 60;

/** Statuses that free the slot again. */
export const NOT_LIVE = ['cancelled', 'noShow'] as const;

/**
 * The employee behind a provider, joined under its own name so a query can also join `employee`
 * for something else. Exported with `providerName`, which reads from it: a query using the name
 * must join this alias, and spelling it again elsewhere would be a second alias the name does not
 * know about.
 */
export const providerEmployee = alias(employee, 'provider_employee');

/** A provider's name as the diary shows it: "Dr Abebe Kebede", or the name alone. */
export const providerName = concatWith(
	' ',
	provider.title,
	providerEmployee.name,
	providerEmployee.fatherName
);

export type BookingRequest = {
	branchId: number;
	startsAt: Date;
	durationMinutes: number;
	operatoryId: number | null;
	providerId: number | null;
	/** The appointment being moved, so it does not collide with itself. */
	excludeId?: number;
};

/**
 * Everything wrong with a proposed slot, as sentences for the person booking. Empty means it may
 * be saved. Run it inside the write's transaction so two people cannot book the same chair in the
 * gap between the check and the insert — as close as this can get without a range constraint.
 */
export async function bookingProblems(reader: Reader, request: BookingRequest): Promise<string[]> {
	const problems: string[] = [];
	const start = request.startsAt;
	const end = new Date(start.getTime() + request.durationMinutes * 60_000);
	const day = clinicDate(start);

	const [closure] = await reader
		.select({ name: clinicClosure.name })
		.from(clinicClosure)
		.where(
			and(
				lte(clinicClosure.startsOn, sql`${day}`),
				gte(clinicClosure.endsOn, sql`${day}`),
				eq(clinicClosure.isActive, true),
				notDeleted(clinicClosure),
				or(isNull(clinicClosure.branchId), eq(clinicClosure.branchId, request.branchId))
			)
		)
		.limit(1);
	if (closure) problems.push(`The clinic is closed that day (${closure.name}).`);

	if (request.operatoryId !== null) {
		const [chair] = await reader
			.select({ branchId: operatory.branchId, name: operatory.name })
			.from(operatory)
			.where(and(eq(operatory.id, request.operatoryId), notDeleted(operatory)))
			.limit(1);

		if (!chair) problems.push('That chair no longer exists.');
		else if (chair.branchId !== request.branchId)
			problems.push(`${chair.name} is at another branch.`);
	}

	/** The first live appointment on this chair (or for this dentist) that overlaps the slot. */
	const overlapping = (column: 'operatoryId' | 'providerId', value: number) =>
		reader
			.select({
				id: appointment.id,
				startsAt: appointment.startsAt,
				patient: patientFullName
			})
			.from(appointment)
			.innerJoin(patient, eq(patient.id, appointment.patientId))
			.where(
				and(
					eq(appointment[column], value),
					notDeleted(appointment),
					notInArray(appointment.status, [...NOT_LIVE]),
					request.excludeId ? ne(appointment.id, request.excludeId) : undefined,
					// Bounded first, so the (column, starts_at) index does the work…
					gt(appointment.startsAt, new Date(start.getTime() - MAX_MINUTES * 60_000)),
					lt(appointment.startsAt, end),
					// …then the exact test: it ends after this one starts.
					gt(addMinutes(appointment.startsAt, appointment.durationMinutes), storedInstant(start))
				)
			)
			.limit(1);

	if (request.operatoryId !== null) {
		const [clash] = await overlapping('operatoryId', request.operatoryId);
		if (clash) problems.push(`That chair is already booked for ${clash.patient} at that time.`);
	}

	if (request.providerId !== null) {
		const [clash] = await overlapping('providerId', request.providerId);
		/*
		 * No patient name here, unlike the chair clash: a dentist's other appointment can be at another
		 * branch, and naming its patient would tell this desk who is being seen there (§15).
		 */
		if (clash) {
			problems.push(`That dentist already has an appointment at ${clinicClock(clash.startsAt)}.`);
		}
	}

	return problems;
}

/** The chairs at a branch, in day-view order. */
export async function chairsAt(branchId: number) {
	return db
		.select({ id: operatory.id, name: operatory.name })
		.from(operatory)
		.where(
			and(eq(operatory.branchId, branchId), eq(operatory.isActive, true), notDeleted(operatory))
		)
		.orderBy(operatory.sortOrder, operatory.name);
}

/**
 * Who can be booked: bookable providers, with their colour and default slot. Not branch scoped —
 * a dentist who works two days at each branch is one provider — so the overlap check, not this
 * list, is what stops them being in two places at once.
 */
export async function bookableProviders() {
	return providerOptions({ bookableOnly: true });
}

/**
 * Active providers for a picker. `bookableOnly` narrows it to those the diary may book; charting
 * work done wants everyone licensed to have done it, including a radiographer nobody books.
 */
export async function providerOptions({
	bookableOnly = false,
	prescribersOnly = false
}: { bookableOnly?: boolean; prescribersOnly?: boolean } = {}) {
	return db
		.select({
			value: provider.id,
			name: providerName,
			colour: provider.colour,
			defaultMinutes: provider.defaultAppointmentMinutes
		})
		.from(provider)
		.innerJoin(
			providerEmployee,
			and(eq(providerEmployee.id, provider.employeeId), notDeleted(providerEmployee))
		)
		.where(
			and(
				bookableOnly ? eq(provider.isBookable, true) : undefined,
				prescribersOnly ? eq(provider.canPrescribe, true) : undefined,
				eq(provider.isActive, true),
				notDeleted(provider)
			)
		)
		.orderBy(providerEmployee.name);
}

/**
 * A provider id from a form, checked to be a live clinician, or null for none. With `prescriber`,
 * also one who holds `canPrescribe` — the rule the prescription table leaves to the write path,
 * since no constraint can reach across to `provider`.
 */
export async function checkedProvider(
	reader: Reader,
	providerId: number | null,
	{ prescriber = false }: { prescriber?: boolean } = {}
): Promise<number | null> {
	if (providerId === null) return null;
	const [row] = await reader
		.select({ id: provider.id, canPrescribe: provider.canPrescribe })
		.from(provider)
		.where(and(eq(provider.id, providerId), eq(provider.isActive, true), notDeleted(provider)))
		.limit(1);
	if (!row) throw new WriteRefused('providerId', 'Choose a clinician from the list.');
	if (prescriber && !row.canPrescribe) {
		throw new WriteRefused('providerId', 'This clinician is not recorded as able to prescribe.');
	}
	return row.id;
}

/**
 * A visit id from a form, checked to be this patient's, or null for none. A note or prescription
 * tied to someone else's appointment would read as that visit's record on the wrong chart.
 */
export async function checkedVisit(
	reader: Reader,
	patientId: number,
	appointmentId: number | null
): Promise<number | null> {
	if (appointmentId === null) return null;
	const [row] = await reader
		.select({ id: appointment.id })
		.from(appointment)
		.where(
			and(
				eq(appointment.id, appointmentId),
				eq(appointment.patientId, patientId),
				notDeleted(appointment)
			)
		)
		.limit(1);
	if (!row) throw new WriteRefused('appointmentId', 'That visit is not on this patient’s record.');
	return row.id;
}

/**
 * The patient's visits a note or a prescription can be tied to: the last sixty days and today's, newest first. What is
 * written about a visit is written soon after it; offering every visit ever would bury the right one.
 */
export async function recentVisits(patientId: number) {
	const since = new Date(Date.now() - 60 * 86_400_000);
	const rows = await db
		.select({ id: appointment.id, startsAt: appointment.startsAt, provider: providerName })
		.from(appointment)
		.leftJoin(provider, eq(provider.id, appointment.providerId))
		.leftJoin(providerEmployee, eq(providerEmployee.id, provider.employeeId))
		.where(
			and(
				eq(appointment.patientId, patientId),
				notDeleted(appointment),
				inArray(appointment.status, ['arrived', 'inChair', 'completed'])
			)
		)
		.orderBy(desc(appointment.startsAt))
		.limit(20);
	return rows.filter((r) => r.startsAt >= since);
}

/** Appointment types for the picker, with the slot length and colour each implies. */
export async function appointmentTypes() {
	return db
		.select({
			value: appointmentType.id,
			name: appointmentType.name,
			defaultMinutes: appointmentType.defaultMinutes,
			colour: appointmentType.colour
		})
		.from(appointmentType)
		.where(and(eq(appointmentType.isActive, true), notDeleted(appointmentType)))
		.orderBy(appointmentType.sortOrder, appointmentType.name);
}

/** The closure covering a clinic-local day at a branch, if any. */
export async function closureOn(day: string, branchId: number | null) {
	const [row] = await db
		.select({ name: clinicClosure.name, note: clinicClosure.note })
		.from(clinicClosure)
		.where(
			and(
				lte(clinicClosure.startsOn, sql`${day}`),
				gte(clinicClosure.endsOn, sql`${day}`),
				eq(clinicClosure.isActive, true),
				notDeleted(clinicClosure),
				branchId === null
					? undefined
					: or(isNull(clinicClosure.branchId), eq(clinicClosure.branchId, branchId))
			)
		)
		.limit(1);
	return row ?? null;
}

/** The columns every screen that lists appointments reads. */
export const appointmentColumns = {
	id: appointment.id,
	startsAt: appointment.startsAt,
	durationMinutes: appointment.durationMinutes,
	status: appointment.status,
	note: appointment.note,
	cancelReason: appointment.cancelReason,
	isNewPatient: appointment.isNewPatient,
	isAsap: appointment.isAsap,
	arrivedAt: appointment.arrivedAt,
	seatedAt: appointment.seatedAt,
	dismissedAt: appointment.dismissedAt,
	confirmedAt: appointment.confirmedAt,
	reminderSentAt: appointment.reminderSentAt,
	branchId: appointment.branchId,
	patientId: patient.id,
	patient: patientFullName,
	fileNo: patient.fileNo,
	phone: patient.phone,
	operatoryId: appointment.operatoryId,
	chair: operatory.name,
	providerId: appointment.providerId,
	provider: providerName,
	providerColour: provider.colour,
	appointmentTypeId: appointment.appointmentTypeId,
	type: appointmentType.name,
	typeColour: appointmentType.colour
};

/**
 * Appointments with everything the screens show about them. Deleted lookups drop out of the join,
 * not the row: a retired chair still shows the visit, just without its name.
 */
export function appointmentQuery(where: SQL | undefined) {
	return db
		.select(appointmentColumns)
		.from(appointment)
		.innerJoin(patient, eq(patient.id, appointment.patientId))
		.leftJoin(operatory, and(eq(operatory.id, appointment.operatoryId), notDeleted(operatory)))
		.leftJoin(provider, and(eq(provider.id, appointment.providerId), notDeleted(provider)))
		.leftJoin(providerEmployee, eq(providerEmployee.id, provider.employeeId))
		.leftJoin(
			appointmentType,
			and(eq(appointmentType.id, appointment.appointmentTypeId), notDeleted(appointmentType))
		)
		.where(and(notDeleted(appointment), where));
}

/** Clamps a requested duration into something a diary can draw. */
export function sanePeriod(minutes: number): number {
	return Math.min(Math.max(Math.round(minutes / 5) * 5, 5), MAX_MINUTES);
}
