import { and, eq, gte, lt } from 'drizzle-orm';

import { db } from '$lib/server/db';
import { appointment, patient } from '$lib/server/db/schema';
import { branchFilter } from '$lib/server/branchScope';
import { hasPermission } from '$lib/server/permissions';
import { flagsFor, livePatient, patientFullName } from '$lib/server/patients';
import {
	appointmentQuery,
	appointmentTypes,
	bookableProviders,
	chairsAt,
	closureOn
} from '$lib/server/appointments';
import {
	BOOK_PERMISSION,
	appointmentActions,
	appointmentForms
} from '$lib/server/appointmentActions';
import { addClinicDays, clinicDayRange, clinicToday, isIsoDate } from '$lib/clinicTime';
import { canMove, isAppointmentStatus } from '$lib/appointmentStatus';
import { visitWork } from '$lib/server/procedures';
import type { PageServerLoad } from './$types';

/**
 * The day view: one clinic-local day at the working branch, a column per chair.
 *
 * **One branch at a time.** Chairs belong to a branch, so a grid of "all branches" would put two
 * clinics' Chair 1 side by side under one heading. Someone seeing every branch is shown the list
 * instead, and asked to pick a branch for the grid (CLAUDE.md §15).
 *
 * `?date=YYYY-MM-DD` chooses the day; `?book=<patientId>` opens the booking form for that patient —
 * the "Book appointment" button on the patient chart lands here; `?open=<appointmentId>` opens one
 * appointment, which is where the list's rows point.
 */
export const load: PageServerLoad = async ({ url, locals }) => {
	const asked = url.searchParams.get('date');
	const day = isIsoDate(asked) ? asked : clinicToday();
	const branchId = locals.branch.active;

	const bookFor = Number(url.searchParams.get('book')) || null;
	const openId = Number(url.searchParams.get('open')) || null;

	const [bookPatient] = bookFor
		? await db
				.select({
					id: patient.id,
					name: patientFullName,
					fileNo: patient.fileNo,
					phone: patient.phone
				})
				.from(patient)
				.where(and(eq(patient.id, bookFor), livePatient()))
				.limit(1)
		: [];

	const [forms, providers, types] = await Promise.all([
		appointmentForms({ patientId: bookPatient?.id }),
		bookableProviders(),
		appointmentTypes()
	]);

	const shared = {
		day,
		previousDay: addClinicDays(day, -1),
		nextDay: addClinicDays(day, 1),
		today: clinicToday(),
		forms,
		providers,
		types,
		bookPatient: bookPatient ?? null,
		openId,
		canBook: hasPermission(locals, BOOK_PERMISSION),
		canChart: hasPermission(locals, 'patients.clinical')
	};

	if (branchId === null) {
		return { ...shared, needsBranch: true as const, chairs: [], appointments: [], closure: null };
	}

	const { start, end } = clinicDayRange(day);

	const [chairs, closure, rows] = await Promise.all([
		chairsAt(branchId),
		closureOn(day, branchId),
		appointmentQuery(
			and(
				gte(appointment.startsAt, start),
				lt(appointment.startsAt, end),
				branchFilter(appointment.branchId, locals.branch)
			)
		).orderBy(appointment.startsAt)
	]);

	/*
	 * The work each visit that can be completed now could record (see `visitWork`). Only for someone
	 * who may both close a visit and read a patient's record: planned treatment is clinical, and the
	 * diary is readable with `appointments.view` alone.
	 */
	const completable = rows.filter(
		(r) => isAppointmentStatus(r.status) && canMove(r.status, 'completed')
	);
	const showWork =
		shared.canBook && hasPermission(locals, 'patients.view') && completable.length > 0;

	// The alerts a clinician needs on the block itself: who not to give penicillin, who bleeds.
	const [flags, work] = await Promise.all([
		flagsFor([...new Set(rows.map((r) => r.patientId))]),
		visitWork(showWork ? completable : [])
	]);

	return {
		...shared,
		needsBranch: false as const,
		chairs,
		closure,
		appointments: rows.map((row) => {
			const f = flags.get(row.patientId);
			return {
				...row,
				severeAllergies:
					f?.allergies.filter((a) => a.severity === 'severe').map((a) => a.name) ?? [],
				medicineAlerts: f?.medicineAlerts ?? [],
				work: work.get(row.id) ?? null
			};
		})
	};
};

export const actions = appointmentActions;
