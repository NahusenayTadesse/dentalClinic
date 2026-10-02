/**
 * The working hours and approved leave of the dentists the diary books, read for
 * `$lib/providerHours.ts`.
 *
 * The facts already live elsewhere: weekly hours on the employee's **Schedule** section
 * (`staff_schedule`) and leave in the leave register. A provider is an employee with a licence
 * (see the note on `provider`), so this module only reads across that link. It adds no table — a
 * second "availability" table would be the same fact in two places, and the two would drift.
 *
 * Two readers, for the two halves of the rule:
 *
 *   - `providerAvailability` hands the day view every bookable dentist's week at once, so the
 *     booking and move dialogs warn as the slot is chosen
 *   - `outsideHours` re-reads one dentist inside the booking's transaction, which is the check that
 *     counts — a dialog left open over a leave approval would otherwise book on stale facts
 *
 * Non-goals: refusing. A booking outside the hours goes through once acknowledged; see the note on
 * `$lib/providerHours.ts` for why that is a warning rather than a wall.
 */
import { and, eq, gte, inArray, sql } from 'drizzle-orm';

import { db } from '$lib/server/db';
import { leave, provider, staffSchedule } from '$lib/server/db/schema';
import { notDeleted } from '$lib/server/softDelete';
import { isoDate } from '$lib/server/db/dialect';
import { providerEmployee, providerName } from '$lib/server/appointments';
import { clinicClock, clinicDate } from '$lib/clinicTime';
import {
	availabilityWarnings,
	type HoursWords,
	type ProviderAvailability
} from '$lib/providerHours';

/** The database or a transaction on it. */
type Reader = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Each provider's week and their approved leave ending on or after `fromDay`, keyed by provider id.
 * A provider missing from the result is not a live provider; one present with no hours has none
 * recorded.
 *
 * Leave before `fromDay` is left out because nothing can be booked into it; leave after it is all
 * read, since the booking dialog can be pointed at any future date and a clinic's approved leave
 * is a handful of rows.
 */
export async function providerAvailability(
	reader: Reader,
	providerIds: number[],
	fromDay: string
): Promise<Map<number, ProviderAvailability>> {
	if (providerIds.length === 0) return new Map();

	const people = await reader
		.select({ id: provider.id, employeeId: provider.employeeId, name: providerName })
		.from(provider)
		.innerJoin(providerEmployee, eq(providerEmployee.id, provider.employeeId))
		.where(and(inArray(provider.id, providerIds), notDeleted(provider)));
	const employeeIds = people.map((p) => p.employeeId);
	if (employeeIds.length === 0) return new Map();

	const [hours, leaves] = await Promise.all([
		reader
			.select({
				staffId: staffSchedule.staffId,
				weekDay: staffSchedule.weekDay,
				start: sql<string>`${staffSchedule.startTime}`,
				end: sql<string>`${staffSchedule.endTime}`
			})
			.from(staffSchedule)
			.where(
				and(
					inArray(staffSchedule.staffId, employeeIds),
					// A stretch switched off on the Schedule section is not one they work.
					eq(staffSchedule.isActive, true),
					notDeleted(staffSchedule)
				)
			),
		reader
			.select({
				staffId: leave.staffId,
				from: isoDate(leave.startDate),
				to: isoDate(leave.endDate)
			})
			.from(leave)
			.where(
				and(
					inArray(leave.staffId, employeeIds),
					eq(leave.status, 'approved'),
					gte(leave.endDate, sql`${fromDay}`),
					notDeleted(leave)
				)
			)
	]);

	return new Map(
		people.map((p) => [
			p.id,
			{
				name: p.name,
				hours: hours
					.filter((h) => h.staffId === p.employeeId)
					.map(({ weekDay, start, end }) => ({ weekDay, start, end })),
				leave: leaves
					.filter((l) => l.staffId === p.employeeId)
					.map(({ from, to }) => ({ from, to }))
			}
		])
	);
}

/**
 * What is outside the dentist's working time about a proposed slot, as sentences; empty when
 * there is no dentist, or it is inside their hours. Run it in the booking's transaction.
 */
export async function outsideHours(
	reader: Reader,
	request: { providerId: number | null; startsAt: Date; durationMinutes: number },
	words?: HoursWords
): Promise<string[]> {
	if (request.providerId === null) return [];
	const day = clinicDate(request.startsAt);
	const who = (await providerAvailability(reader, [request.providerId], day)).get(
		request.providerId
	);
	return who
		? availabilityWarnings(who, day, clinicClock(request.startsAt), request.durationMinutes, words)
		: [];
}
