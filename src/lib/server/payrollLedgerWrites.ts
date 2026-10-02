import { and, desc, eq, gte, inArray, isNull, lte, or, sql } from 'drizzle-orm';

import { db } from '$lib/server/db';
import { employee, overTimeType, payrollEntries, salaries } from '$lib/server/db/schema';
import { notDeleted, softDeleteLookup } from '$lib/server/softDelete';
import { isApproved, unapprovedEmployeeIds } from '$lib/server/approvals';
import { recordAudit, type AuditRequest } from '$lib/server/audit';
import { insertReturningId } from '@nahu/admin-kit/server/db/insert.js';
import { isoDate } from '$lib/server/db/dialect';
import { WriteRefused, refuseUnless } from '$lib/server/childCrud';
import { employeeLegalName } from '$lib/server/employeeName';
import { SOURCES } from '$lib/server/payrollLedger';
import { cents } from '$lib/invoiceStatus';
import { isIsoDate } from '$lib/clinicTime';
import type { LedgerKind } from '$lib/payrollLedger';

/**
 * Recording, changing and removing pay adjustments — the write half of `server/payrollLedger.ts`,
 * whose header says what the rules are and which of them were broken before. Every function runs
 * inside the caller's transaction and refuses with `WriteRefused`, so a refusal rolls back
 * everything the same request had done.
 */

/** A transaction on the database, as `db.transaction` hands it over. */
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Reader = Tx | typeof db;

/** The hours in a working month, for an hourly rate from a monthly salary — as payroll has used. */
export const HOURS_PER_MONTH = 192;

/** An adjustment as the form posts it, already narrowed from strings. */
export type LedgerInput = {
	date: string;
	typeId: number | null;
	type: string | null;
	hours: number | null;
	amount: number | null;
	reason: string | null;
};

/** The employees among `staffIds` whose payslip already covers `date`. */
async function paidOn(reader: Reader, staffIds: number[], date: string) {
	if (!staffIds.length) return [];
	return reader
		.selectDistinct({ id: employee.id, name: employeeLegalName })
		.from(payrollEntries)
		.innerJoin(employee, eq(employee.id, payrollEntries.staffId))
		.where(
			and(
				inArray(payrollEntries.staffId, staffIds),
				lte(payrollEntries.payPeriodStart, date),
				gte(payrollEntries.payPeriodEnd, date),
				notDeleted(payrollEntries)
			)
		);
}

/** Refuses a date inside a paid period for any of these employees, naming who. */
async function refusePaid(tx: Tx, staffIds: number[], date: string) {
	const paid = await paidOn(tx, staffIds, date);
	refuseUnless(
		paid.length === 0,
		`Already paid for that month: ${paid.map((p) => p.name).join(', ')}. An adjustment there would never be paid — date it in an unpaid month.`,
		'date'
	);
}

/**
 * Each employee's monthly salary in force on `date`: approved, open that day, the latest-starting
 * when two overlap. Refuses anyone with none, by name, rather than skipping them.
 */
async function salariesOn(tx: Tx, staffIds: number[], date: string) {
	const rows = await tx
		.select({
			staffId: salaries.staffId,
			name: employeeLegalName,
			amount: salaries.amount,
			startDate: salaries.startDate
		})
		.from(salaries)
		.innerJoin(employee, eq(employee.id, salaries.staffId))
		.where(
			and(
				inArray(salaries.staffId, staffIds),
				lte(salaries.startDate, date),
				or(isNull(salaries.endDate), gte(salaries.endDate, date)),
				isApproved(salaries),
				notDeleted(salaries)
			)
		)
		.orderBy(desc(salaries.startDate));
	const byStaff = new Map<number, number>();
	for (const row of rows) {
		if (!byStaff.has(row.staffId)) byStaff.set(row.staffId, Number(row.amount));
	}
	const missing = staffIds.filter((id) => !byStaff.has(id));
	if (missing.length) {
		const names = await tx
			.select({ name: employeeLegalName })
			.from(employee)
			.where(inArray(employee.id, missing));
		refuseUnless(
			false,
			`No approved salary on that day for: ${names.map((n) => n.name).join(', ')}. Overtime is priced from it.`,
			'staffIds'
		);
	}
	return byStaff;
}

/** The overtime type, live, and the hours checked against its limit. */
async function overtimeRate(tx: Tx, typeId: number | null, hours: number | null) {
	if (typeId === null) throw new WriteRefused('typeId', 'Choose the overtime type.');
	if (hours === null || hours <= 0) throw new WriteRefused('hours', 'Enter the hours worked.');
	const [type] = await tx
		.select({ rate: overTimeType.rate, maxHours: overTimeType.maxhours, name: overTimeType.name })
		.from(overTimeType)
		.where(and(eq(overTimeType.id, typeId), notDeleted(overTimeType)))
		.limit(1);
	if (!type) throw new WriteRefused('typeId', 'Choose an overtime type from the list.');
	refuseUnless(
		type.maxHours === null || hours <= type.maxHours,
		`${type.name} allows at most ${type.maxHours} hours.`,
		'hours'
	);
	return { rate: Number(type.rate), hours };
}

/** The columns one entry writes, for a kind, priced where it must be. */
function valuesFor(
	kind: LedgerKind,
	input: LedgerInput,
	priced: { hourly?: number; rate?: number; hours?: number }
) {
	switch (kind) {
		case 'overtime': {
			const perHour = cents((priced.hourly ?? 0) * (priced.rate ?? 0));
			return {
				date: input.date,
				overTimeTypeId: input.typeId,
				hours: String(priced.hours),
				amountPerHour: String(perHour),
				total: String(cents(perHour * (priced.hours ?? 0))),
				reason: input.reason
			};
		}
		case 'bonuses':
			return {
				bonusDate: input.date,
				amount: String(cents(input.amount ?? 0)),
				description: input.reason
			};
		case 'deductions':
			return {
				deductionDate: input.date,
				amount: String(cents(input.amount ?? 0)),
				type: input.type ?? '',
				reason: input.reason ?? ''
			};
	}
}

/** The checks every kind shares that do not depend on who. */
function checkInput(kind: LedgerKind, input: LedgerInput) {
	refuseUnless(isIsoDate(input.date), 'Choose the date.', 'date');
	if (kind !== 'overtime') {
		refuseUnless(input.amount !== null && input.amount > 0, 'Enter the amount.', 'amount');
	}
	if (kind === 'deductions') {
		refuseUnless(Boolean(input.type?.trim()), 'Say what kind of deduction it is.', 'type');
		refuseUnless(Boolean(input.reason?.trim()), 'Say why it is deducted.', 'reason');
	}
}

/**
 * Records one adjustment for each of `staffIds`, all or none. Returns how many it recorded.
 * One audit row for the whole entry.
 */
export async function recordAdjustments(
	tx: Tx,
	event: AuditRequest,
	kind: LedgerKind,
	staffIds: number[],
	input: LedgerInput
): Promise<number> {
	const ids = [...new Set(staffIds)];
	checkInput(kind, input);
	const blocked = await unapprovedEmployeeIds(ids, tx);
	refuseUnless(
		blocked.length === 0,
		`${blocked.length} of the chosen employees are not approved, so nothing can be recorded for them.`,
		'staffIds'
	);
	await refusePaid(tx, ids, input.date);

	const overtime = kind === 'overtime' ? await overtimeRate(tx, input.typeId, input.hours) : null;
	const salary = overtime ? await salariesOn(tx, ids, input.date) : null;

	const src = SOURCES[kind];
	const made: number[] = [];
	for (const staffId of ids) {
		const values = valuesFor(kind, input, {
			hourly: salary ? (salary.get(staffId) ?? 0) / HOURS_PER_MONTH : undefined,
			rate: overtime?.rate,
			hours: overtime?.hours
		});
		made.push(
			await insertReturningId(tx, src.table, {
				...values,
				staffId,
				createdBy: event.locals.user?.id
			})
		);
	}
	await recordAudit(tx, event, {
		table: src.audit,
		recordId: made[0],
		action: 'create',
		detail: made.length > 1 ? { bulk: { ids: made, staffIds: ids } } : undefined
	});
	return made.length;
}

/** One live adjustment of a kind, for changing or removing it. */
async function existing(tx: Tx, kind: LedgerKind, id: number) {
	const src = SOURCES[kind];
	const [row] = await tx
		.select({ staffId: sql<number>`${src.staffId}`, date: isoDate(src.date) })
		.from(src.table)
		.where(and(eq(src.id, id), notDeleted(src.table)))
		.limit(1)
		.for('update');
	refuseUnless(Boolean(row), 'That entry no longer exists.');
	await refusePaid(tx, [Number(row.staffId)], row.date);
	return { staffId: Number(row.staffId), date: row.date };
}

/** Changes one adjustment, re-priced; refused if it was paid or would move into a paid month. */
export async function updateAdjustment(
	tx: Tx,
	event: AuditRequest,
	kind: LedgerKind,
	id: number,
	input: LedgerInput
) {
	const src = SOURCES[kind];
	const row = await existing(tx, kind, id);
	checkInput(kind, input);
	await refusePaid(tx, [row.staffId], input.date);

	const overtime = kind === 'overtime' ? await overtimeRate(tx, input.typeId, input.hours) : null;
	const salary = overtime ? await salariesOn(tx, [row.staffId], input.date) : null;
	const values = {
		...valuesFor(kind, input, {
			hourly: salary ? (salary.get(row.staffId) ?? 0) / HOURS_PER_MONTH : undefined,
			rate: overtime?.rate,
			hours: overtime?.hours
		}),
		updatedBy: event.locals.user?.id
	};
	const [before] = await tx.select().from(src.table).where(eq(src.id, id));
	await tx.update(src.table).set(values).where(eq(src.id, id));
	await recordAudit(tx, event, {
		table: src.audit,
		recordId: id,
		action: 'update',
		before,
		after: values
	});
}

/** Removes one adjustment (soft delete); refused once paid. The caller checks super admin. */
export async function removeAdjustment(tx: Tx, event: AuditRequest, kind: LedgerKind, id: number) {
	const src = SOURCES[kind];
	await existing(tx, kind, id);
	await softDeleteLookup(tx, src.table, id, event.locals.user?.id);
	await recordAudit(tx, event, { table: src.audit, recordId: id, action: 'delete' });
}
