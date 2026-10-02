import { and, asc, eq, gte, inArray, lte, min, sql } from 'drizzle-orm';

import { db } from '$lib/server/db';
import {
	attendance,
	branch,
	clinicClosure,
	department,
	employee,
	leave,
	payrollEntries,
	position,
	staffSchedule
} from '$lib/server/db/schema';
import { notDeleted, softDeleteLookup } from '$lib/server/softDelete';
import { isApproved } from '$lib/server/approvals';
import { recordAudit, type AuditRequest } from '$lib/server/audit';
import { insertReturningId } from '@nahu/admin-kit/server/db/insert.js';
import { isoDate } from '$lib/server/db/dialect';
import { branchFilter, type BranchContext } from '$lib/server/branchScope';
import { WriteRefused, refuseUnless } from '$lib/server/childCrud';
import { employeeLegalName } from '$lib/server/employeeName';
import { clinicToday, isIsoDate } from '$lib/clinicTime';
import {
	dayStatus,
	daysBetween,
	scheduleWeekday,
	type AttendanceRecord,
	type DayStatus,
	type ScheduleDay
} from '$lib/attendance';

/**
 * The attendance register: gathering what decides each day, and writing the times.
 *
 * **Reading** collects, for a set of staff and a range of days, the five facts `$lib/attendance.ts`
 * decides from — the schedule, the recorded times, approved leave, clinic closures, and when each
 * person's days start being judged — in one query each, then decides every day in memory. A month
 * for a clinic's staff is a few thousand days; deciding them is cheaper than any SQL that tried to
 * express "scheduled, not on leave, not closed, not recorded" portably (CLAUDE.md §10).
 *
 * **When judging starts.** For each branch, the first day anyone there was recorded — so a branch
 * that starts using the register is not handed months of absences for the days before it, and a
 * second branch can start later than the first. For a person, the later of that and their hire.
 *
 * **Writing** is the register's few acts — in, out, both times, excused, cleared — each audited
 * (pay depends on it), each refused for a day in a period that person has already been paid for:
 * the payslip is written, so changing the day would change nothing but the record of why.
 *
 * Non-goals: a time clock (fingerprint, card) — the times are what the desk enters; and overtime
 * from hours, which is recorded on its own ledger.
 */

/** A transaction on the database, as `db.transaction` hands it over. */
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Reader = Tx | typeof db;

/** Who may keep the register: the page's own rule, checked again by each action. */
export const ATTENDANCE_PERMISSION = 'attendance.manage';

/** One person on the register, with every day of the range decided. */
export type RegisterRow = {
	id: number;
	name: string;
	department: string | null;
	position: string | null;
	branch: string | null;
	days: Record<string, DayStatus & { record: (AttendanceRecord & { id: number }) | null }>;
};

/** `HH:MM` from a stored `HH:MM:SS`. */
const hhmm = (time: string | null) => (time ? time.slice(0, 5) : null);

/**
 * Every active, approved employee in scope over `from`–`to`, each day decided. `staffIds` narrows
 * to some; `branch` scopes to the viewer's branch, or pass `null` for every branch (payroll).
 */
export async function register(
	from: string,
	to: string,
	{
		branch: scope = null,
		staffIds,
		reader = db
	}: {
		branch?: Pick<BranchContext, 'active'> | null;
		staffIds?: number[];
		reader?: Reader;
	} = {}
): Promise<RegisterRow[]> {
	const staff = await reader
		.select({
			id: employee.id,
			name: employeeLegalName,
			department: department.name,
			position: position.name,
			branchId: employee.branchId,
			branch: branch.name,
			hiredOn: isoDate(employee.hireDate)
		})
		.from(employee)
		.leftJoin(department, and(eq(department.id, employee.departmentId), notDeleted(department)))
		.leftJoin(position, and(eq(position.id, employee.positionId), notDeleted(position)))
		.leftJoin(branch, and(eq(branch.id, employee.branchId), notDeleted(branch)))
		.where(
			and(
				eq(employee.isActive, true),
				isApproved(employee),
				notDeleted(employee),
				scope ? branchFilter(employee.branchId, scope) : undefined,
				staffIds ? inArray(employee.id, staffIds.length ? staffIds : [-1]) : undefined
			)
		)
		.orderBy(asc(department.name), asc(employeeLegalName));
	if (!staff.length) return [];
	const ids = staff.map((s) => s.id);

	const [schedules, records, leaves, closures, starts] = await Promise.all([
		reader
			.select({
				staffId: staffSchedule.staffId,
				weekDay: staffSchedule.weekDay,
				start: sql<string>`${staffSchedule.startTime}`,
				end: sql<string>`${staffSchedule.endTime}`
			})
			.from(staffSchedule)
			.where(and(inArray(staffSchedule.staffId, ids), notDeleted(staffSchedule))),
		reader
			.select({
				id: attendance.id,
				staffId: attendance.staffId,
				day: attendance.day,
				status: attendance.status,
				clockIn: sql<string | null>`${attendance.clockIn}`,
				clockOut: sql<string | null>`${attendance.clockOut}`,
				note: attendance.note
			})
			.from(attendance)
			.where(
				and(
					inArray(attendance.staffId, ids),
					gte(attendance.day, from),
					lte(attendance.day, to),
					notDeleted(attendance)
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
					inArray(leave.staffId, ids),
					eq(leave.status, 'approved'),
					sql`${leave.startDate} <= ${to}`,
					sql`${leave.endDate} >= ${from}`,
					notDeleted(leave)
				)
			),
		reader
			.select({
				branchId: clinicClosure.branchId,
				from: isoDate(clinicClosure.startsOn),
				to: isoDate(clinicClosure.endsOn)
			})
			.from(clinicClosure)
			.where(
				and(
					sql`${clinicClosure.startsOn} <= ${to}`,
					sql`${clinicClosure.endsOn} >= ${from}`,
					notDeleted(clinicClosure)
				)
			),
		reader
			.select({ branchId: attendance.branchId, first: min(attendance.day) })
			.from(attendance)
			.where(notDeleted(attendance))
			.groupBy(attendance.branchId)
	]);

	const scheduleOf = new Map<number, Map<number, ScheduleDay>>();
	for (const s of schedules) {
		const week = scheduleOf.get(s.staffId) ?? new Map<number, ScheduleDay>();
		week.set(s.weekDay, { start: s.start, end: s.end });
		scheduleOf.set(s.staffId, week);
	}
	const recordOf = new Map(records.map((r) => [`${r.staffId}:${r.day}`, r]));
	const startOf = new Map(starts.map((s) => [s.branchId, s.first]));
	const today = clinicToday();
	const days = daysBetween(from, to);

	return staff.map((person) => {
		const registerStart = startOf.get(person.branchId) ?? null;
		const judgedFrom =
			registerStart === null
				? null
				: person.hiredOn && person.hiredOn > registerStart
					? person.hiredOn
					: registerStart;
		const week = scheduleOf.get(person.id);
		const decided: RegisterRow['days'] = {};
		for (const day of days) {
			const row = recordOf.get(`${person.id}:${day}`);
			const record = row
				? {
						id: row.id,
						status: row.status,
						clockIn: hhmm(row.clockIn),
						clockOut: hhmm(row.clockOut),
						note: row.note
					}
				: null;
			decided[day] = {
				...dayStatus({
					day,
					today,
					judgedFrom,
					schedule: week?.get(scheduleWeekday(day)) ?? null,
					record,
					onLeave: leaves.some((l) => l.staffId === person.id && l.from <= day && l.to >= day),
					closed: closures.some(
						(c) =>
							(c.branchId === null || c.branchId === person.branchId) &&
							c.from <= day &&
							c.to >= day
					)
				}),
				record
			};
		}
		return {
			id: person.id,
			name: person.name,
			department: person.department,
			position: person.position,
			branch: person.branch,
			days: decided
		};
	});
}

/**
 * Unexcused absences per employee between two days, for payroll — the same rule the register
 * shows, across every branch, so the payslip and the grid cannot disagree.
 */
export async function absencesBetween(
	from: string,
	to: string,
	staffIds?: number[],
	reader: Reader = db
): Promise<Map<number, number>> {
	const rows = await register(from, to, { staffIds, reader });
	return new Map(
		rows.map((row) => [row.id, Object.values(row.days).filter((d) => d.kind === 'absent').length])
	);
}

/** Days the register still treats as absences, unrecorded, in a range — what payroll warns about. */
export async function unrecordedAbsences(
	from: string,
	to: string,
	branch: Pick<BranchContext, 'active'>
) {
	const rows = await register(from, to, { branch });
	return rows
		.map((row) => ({
			id: row.id,
			name: row.name,
			days: Object.entries(row.days)
				.filter(([, d]) => d.kind === 'absent')
				.map(([day]) => day)
		}))
		.filter((row) => row.days.length > 0);
}

/* ── Writing ────────────────────────────────────────────────────────────────────────────────── */

/** A `HH:MM` time, refused under the field otherwise. */
function checkedTime(value: string | null | undefined, field: string): string {
	refuseUnless(Boolean(value && /^([01]\d|2[0-3]):[0-5]\d$/.test(value)), 'Enter a time.', field);
	return value as string;
}

/**
 * The person, live, approved and at a branch the viewer may see; the day, a real one not to come;
 * and not a day already paid for.
 */
async function checkedDay(
	tx: Tx,
	scope: Pick<BranchContext, 'active'>,
	staffId: number,
	day: string
) {
	refuseUnless(isIsoDate(day), 'Choose the day.', 'day');
	refuseUnless(day <= clinicToday(), 'That day has not come yet.', 'day');
	const [person] = await tx
		.select({ id: employee.id, branchId: employee.branchId, name: employeeLegalName })
		.from(employee)
		.where(
			and(
				eq(employee.id, staffId),
				eq(employee.isActive, true),
				isApproved(employee),
				notDeleted(employee),
				branchFilter(employee.branchId, scope)
			)
		)
		.limit(1);
	if (!person) throw new WriteRefused(null, 'That employee is not on this branch’s register.');
	const [paid] = await tx
		.select({ id: payrollEntries.id })
		.from(payrollEntries)
		.where(
			and(
				eq(payrollEntries.staffId, staffId),
				lte(payrollEntries.payPeriodStart, day),
				gte(payrollEntries.payPeriodEnd, day),
				notDeleted(payrollEntries)
			)
		)
		.limit(1);
	refuseUnless(
		!paid,
		`${person.name} has already been paid for that month, so the day can no longer change.`,
		'day'
	);
	return person;
}

/** The live row for a person's day, locked, or null. */
async function rowFor(tx: Tx, staffId: number, day: string) {
	const [row] = await tx
		.select({
			id: attendance.id,
			status: attendance.status,
			clockIn: sql<string | null>`${attendance.clockIn}`,
			clockOut: sql<string | null>`${attendance.clockOut}`,
			note: attendance.note
		})
		.from(attendance)
		.where(and(eq(attendance.staffId, staffId), eq(attendance.day, day), notDeleted(attendance)))
		.limit(1)
		.for('update');
	return row ?? null;
}

/** What one register act sets. */
export type RegisterAct =
	| { act: 'in'; time: string }
	| { act: 'out'; time: string }
	| { act: 'times'; clockIn: string; clockOut: string | null }
	| { act: 'excuse'; note: string }
	| { act: 'clear' };

/** Records one act for one person's day. Returns what the toast says. */
export async function recordDay(
	tx: Tx,
	event: AuditRequest & { locals: { branch: Pick<BranchContext, 'active'> } },
	staffId: number,
	day: string,
	act: RegisterAct
): Promise<string> {
	const person = await checkedDay(tx, event.locals.branch, staffId, day);
	const row = await rowFor(tx, staffId, day);
	const userId = event.locals.user?.id;

	let values: {
		status: 'present' | 'excused';
		clockIn: string | null;
		clockOut: string | null;
		note: string | null;
	};
	let said: string;
	switch (act.act) {
		case 'in':
			values = {
				status: 'present',
				clockIn: checkedTime(act.time, 'time'),
				clockOut: row?.status === 'present' ? hhmm(row.clockOut) : null,
				note: row?.note ?? null
			};
			said = `${person.name} in at ${act.time}.`;
			break;
		case 'out': {
			const time = checkedTime(act.time, 'time');
			refuseUnless(
				row?.status === 'present' && Boolean(row.clockIn),
				`${person.name} has not been marked in that day.`,
				'time'
			);
			refuseUnless(
				time >= (hhmm(row?.clockIn ?? null) ?? ''),
				'They cannot leave before they came in.',
				'time'
			);
			values = {
				status: 'present',
				clockIn: hhmm(row?.clockIn ?? null),
				clockOut: time,
				note: row?.note ?? null
			};
			said = `${person.name} out at ${time}.`;
			break;
		}
		case 'times': {
			const clockIn = checkedTime(act.clockIn, 'clockIn');
			const clockOut = act.clockOut ? checkedTime(act.clockOut, 'clockOut') : null;
			refuseUnless(
				clockOut === null || clockOut >= clockIn,
				'They cannot leave before they came in.',
				'clockOut'
			);
			values = { status: 'present', clockIn, clockOut, note: row?.note ?? null };
			said = `${person.name}’s times saved.`;
			break;
		}
		case 'excuse':
			refuseUnless(Boolean(act.note.trim()), 'Say why they were away.', 'note');
			values = { status: 'excused', clockIn: null, clockOut: null, note: act.note.trim() };
			said = `${person.name}’s absence excused — it will not be deducted.`;
			break;
		case 'clear':
			if (row) {
				await softDeleteLookup(tx, attendance, row.id, userId);
				await recordAudit(tx, event, { table: 'attendance', recordId: row.id, action: 'delete' });
			}
			return `${person.name}’s day cleared.`;
	}

	if (row) {
		await tx
			.update(attendance)
			.set({ ...values, updatedBy: userId })
			.where(eq(attendance.id, row.id));
		await recordAudit(tx, event, {
			table: 'attendance',
			recordId: row.id,
			action: 'update',
			before: { ...row, clockIn: hhmm(row.clockIn), clockOut: hhmm(row.clockOut) },
			after: values
		});
	} else {
		const id = await insertReturningId(tx, attendance, {
			...values,
			staffId,
			day,
			branchId: event.locals.branch.active ?? person.branchId ?? undefined,
			createdBy: userId
		});
		await recordAudit(tx, event, { table: 'attendance', recordId: id, action: 'create' });
	}
	return said;
}

/**
 * Everyone scheduled on `day` at this branch with nothing recorded yet, marked in at their
 * scheduled start — the morning's one tap when everybody came. One audit row for the lot.
 * Returns how many were marked.
 */
export async function markScheduledIn(
	tx: Tx,
	event: AuditRequest & { locals: { branch: Pick<BranchContext, 'active'> } },
	day: string
): Promise<number> {
	refuseUnless(isIsoDate(day) && day <= clinicToday(), 'Choose a day that has come.', 'day');
	const rows = await register(day, day, { branch: event.locals.branch, reader: tx });
	const waiting = rows.filter((r) => {
		const d = r.days[day];
		return (
			!d.record &&
			d.scheduled &&
			(d.kind === 'notYet' || d.kind === 'absent' || d.kind === 'unjudged')
		);
	});
	const made: number[] = [];
	for (const person of waiting) {
		const paid = await tx
			.select({ id: payrollEntries.id })
			.from(payrollEntries)
			.where(
				and(
					eq(payrollEntries.staffId, person.id),
					lte(payrollEntries.payPeriodStart, day),
					gte(payrollEntries.payPeriodEnd, day),
					notDeleted(payrollEntries)
				)
			)
			.limit(1);
		if (paid.length) continue;
		made.push(
			await insertReturningId(tx, attendance, {
				staffId: person.id,
				day,
				status: 'present',
				clockIn: hhmm(person.days[day].scheduled?.start ?? null),
				branchId: event.locals.branch.active ?? undefined,
				createdBy: event.locals.user?.id
			})
		);
	}
	if (made.length) {
		await recordAudit(tx, event, {
			table: 'attendance',
			recordId: made[0],
			action: 'create',
			detail: { bulk: { day, ids: made } }
		});
	}
	return made.length;
}
