/**
 * Reminding patients of the appointment they already have: the day's call list, the record that a
 * reminder went out, and whether reminding them makes any difference.
 *
 * A reminder is not a recall (see the note on `recall`): it goes to someone who has booked, and
 * exists to stop them missing it. Its only column is `appointment.reminderSentAt`, which the schema
 * kept for two reasons this module serves — not ringing a patient twice, and being able to say
 * whether reminders reduce no-shows at all (`reminderEffect`).
 *
 * Recording a reminder can also confirm the visit, because that is usually the same phone call:
 * "yes, I'll be there" is the patient confirming. The move goes through `$lib/appointmentStatus.ts`
 * like every other, so only a visit still `scheduled` is confirmed by it.
 *
 * Non-goals: sending anything. The clinic rings or texts from its own phone; there is no SMS
 * gateway here, and an email nobody at the desk saw go out is not a reminder anyone can vouch for.
 * Who was reminded *how* is not recorded either — the schema has one timestamp, and a method column
 * would be a migration for a question nobody has asked yet.
 */
import { and, count, eq, gte, inArray, lt, sql } from 'drizzle-orm';
import { error, type RequestEvent } from '@sveltejs/kit';

import { db } from '$lib/server/db';
import { appointment } from '$lib/server/db/schema';
import { notDeleted } from '$lib/server/softDelete';
import { branchFilter, type BranchContext } from '$lib/server/branchScope';
import { refuseUnless } from '$lib/server/childCrud';
import { recordAudit, type AuditRequest } from '$lib/server/audit';
import { appointmentQuery } from '$lib/server/appointments';
import { canMove, isAppointmentStatus } from '$lib/appointmentStatus';
import { addClinicDays, clinicDayRange, clinicToday } from '$lib/clinicTime';

/** The database or a transaction on it. */
type Reader = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Who reminds: whoever books. Ringing a patient about their visit is the diary's work. */
export const REMINDER_PERMISSION = 'appointments.book';

/** Statuses still to come, and so worth a reminder. */
const AHEAD = ['scheduled', 'confirmed'] as const;

/** How far back `reminderEffect` looks, in days. */
export const EFFECT_WINDOW_DAYS = 90;

/**
 * The appointments on a clinic-local day at the working branch that are still to come, earliest
 * first, with when each was last reminded.
 */
export async function remindersFor(branch: Pick<BranchContext, 'active'>, day: string) {
	const { start, end } = clinicDayRange(day);
	return appointmentQuery(
		and(
			gte(appointment.startsAt, start),
			lt(appointment.startsAt, end),
			inArray(appointment.status, [...AHEAD]),
			branchFilter(appointment.branchId, branch)
		)
	).orderBy(appointment.startsAt);
}

/**
 * The appointment a reminder is posted for, if it is at the working branch — or a 404. Resolved
 * before the write so another branch's id is answered as missing rather than refused (§15).
 */
export async function reminderOwner(event: RequestEvent, appointmentId: number): Promise<number> {
	const [row] = await db
		.select({ id: appointment.id })
		.from(appointment)
		.where(
			and(
				eq(appointment.id, appointmentId),
				notDeleted(appointment),
				branchFilter(appointment.branchId, event.locals.branch)
			)
		)
		.limit(1);
	if (!row) error(404, 'That appointment is not at this branch.');
	return row.id;
}

/**
 * Records that the patient was reminded just now and, if they said they would come, confirms the
 * visit. Audited as one change to the appointment. Returns the text for the desk.
 *
 * Re-reminding is allowed and moves the timestamp: it is when a reminder *last* went out, which is
 * what stops a third call the same afternoon.
 */
export async function recordReminder(
	tx: Tx,
	event: AuditRequest,
	appointmentId: number,
	{ confirmed }: { confirmed: boolean }
): Promise<string> {
	const [row] = await tx
		.select()
		.from(appointment)
		.where(and(eq(appointment.id, appointmentId), notDeleted(appointment)))
		.limit(1)
		.for('update');
	refuseUnless(Boolean(row), 'That appointment no longer exists.');
	refuseUnless(
		isAppointmentStatus(row.status) && (AHEAD as readonly string[]).includes(row.status),
		'Only an appointment still to come can be reminded.'
	);

	const now = new Date();
	const confirms = confirmed && isAppointmentStatus(row.status) && canMove(row.status, 'confirmed');
	const values = {
		reminderSentAt: now,
		...(confirms ? { status: 'confirmed' as const, confirmedAt: row.confirmedAt ?? now } : {}),
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

	if (confirms) return 'Reminded, and marked confirmed';
	return row.status === 'confirmed' ? 'Reminded — already confirmed' : 'Reminder recorded';
}

/** One side of the comparison: how many visits, and how many of them were missed. */
export type NoShowShare = { visits: number; noShows: number; rate: number | null };

/**
 * Whether reminding works here: of the visits that came due at this branch in the last
 * `EFFECT_WINDOW_DAYS` days — attended or missed — the no-show rate among those reminded and among
 * those not. Cancellations are left out: a patient who rang to cancel did what a reminder asks.
 *
 * Grouped by whether the column is set, which reads the same on every engine (CLAUDE.md §10).
 */
export async function reminderEffect(
	branch: Pick<BranchContext, 'active'>,
	reader: Reader = db
): Promise<{ reminded: NoShowShare; notReminded: NoShowShare }> {
	const since = clinicDayRange(addClinicDays(clinicToday(), -EFFECT_WINDOW_DAYS)).start;
	const { start: todayStart } = clinicDayRange(clinicToday());
	const reminded = sql<number>`CASE WHEN ${appointment.reminderSentAt} IS NULL THEN 0 ELSE 1 END`;

	const rows = await reader
		.select({ reminded, status: appointment.status, n: count() })
		.from(appointment)
		.where(
			and(
				gte(appointment.startsAt, since),
				lt(appointment.startsAt, todayStart),
				inArray(appointment.status, ['completed', 'noShow']),
				notDeleted(appointment),
				branchFilter(appointment.branchId, branch)
			)
		)
		.groupBy(reminded, appointment.status);

	const share = (wasReminded: boolean): NoShowShare => {
		const mine = rows.filter((r) => Boolean(Number(r.reminded)) === wasReminded);
		const visits = mine.reduce((sum, r) => sum + Number(r.n), 0);
		const noShows = mine
			.filter((r) => r.status === 'noShow')
			.reduce((sum, r) => sum + Number(r.n), 0);
		return { visits, noShows, rate: visits ? noShows / visits : null };
	};
	return { reminded: share(true), notReminded: share(false) };
}
