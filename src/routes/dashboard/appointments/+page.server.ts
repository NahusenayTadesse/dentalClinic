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
import { labStatusFor } from '$lib/server/labCases';
import { workToBook } from '$lib/server/treatmentPlans';
import type { PageServerLoad } from './$types';

/**
 * The day view: one clinic-local day at the working branch, a column per chair.
 *
 * **One branch at a time.** Chairs belong to a branch, so a grid of "all branches" would put two
 * clinics' Chair 1 side by side under one heading. Someone seeing every branch is shown the list
 * instead, and asked to pick a branch for the grid (CLAUDE.md §15).
 *
 * `?date=YYYY-MM-DD` chooses the day; `?book=<patientId>` opens the booking form for that patient —
 * the "Book appointment" button on the patient chart lands here — and `&type=<appointmentTypeId>`
 * chooses the kind of visit, which is how a recall books the check-up it is for, and
 * `&plan=<planId>` books a treatment plan's agreed work, which the booking then reserves;
 * `?open=<appointmentId>` opens one appointment, which is where the list's rows point.
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

	const [providers, types] = await Promise.all([bookableProviders(), appointmentTypes()]);
	// A type from the link only if it is one on offer; its usual length comes with it.
	const bookType = types.find((t) => t.value === Number(url.searchParams.get('type')));
	// From a treatment plan: its agreed work not yet booked. Only when there is some — a plan whose
	// work is all booked or done books an ordinary appointment.
	const planId = Number(url.searchParams.get('plan')) || null;
	const planWork = bookPatient && planId ? await workToBook(bookPatient.id, planId) : [];
	const bookPlan = planWork.length
		? { id: planId as number, work: planWork.map((w) => w.description) }
		: null;
	const forms = await appointmentForms({
		patientId: bookPatient?.id,
		appointmentTypeId: bookPatient ? bookType?.value : undefined,
		durationMinutes: bookPatient ? bookType?.defaultMinutes : undefined,
		planId: bookPlan?.id,
		note: bookPlan ? `Treatment plan: ${bookPlan.work.join('; ')}`.slice(0, 500) : undefined
	});

	const shared = {
		day,
		previousDay: addClinicDays(day, -1),
		nextDay: addClinicDays(day, 1),
		today: clinicToday(),
		forms,
		providers,
		types,
		bookPatient: bookPatient ?? null,
		bookPlan,
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

	// The alerts a clinician needs on the block itself: who not to give penicillin, who bleeds —
	// and whether the crown they are coming in to have fitted is back from the lab.
	const patientIds = [...new Set(rows.map((r) => r.patientId))];
	const [flags, work, lab] = await Promise.all([
		flagsFor(patientIds),
		visitWork(showWork ? completable : []),
		labStatusFor(patientIds)
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
				work: work.get(row.id) ?? null,
				lab: lab.get(row.patientId) ?? null
			};
		})
	};
};

export const actions = appointmentActions;
