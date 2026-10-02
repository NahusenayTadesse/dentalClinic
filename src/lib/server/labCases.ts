import { and, asc, desc, eq, inArray, notInArray } from 'drizzle-orm';

import type { RequestEvent } from '@sveltejs/kit';

import { db } from '$lib/server/db';
import { ownedAction } from '$lib/server/patientAction';
import { moveLabCase as moveLabCaseForm } from '$lib/forms/labCase';
import { dentalLab, labCase, patient, procedures, provider, services } from '$lib/server/db/schema';
import { insertReturningId } from '$lib/server/db/insert';
import { isoDate } from '$lib/server/db/dialect';
import { notDeleted } from '$lib/server/softDelete';
import { recordAudit, type AuditRequest } from '$lib/server/audit';
import { refuseUnless } from '$lib/server/childCrud';
import { branchFilter, type BranchContext } from '$lib/server/branchScope';
import { checkedProvider, providerEmployee, providerName } from '$lib/server/appointments';
import { livePatient, patientFullName } from '$lib/server/patients';
import { addClinicDays, clinicToday, isIsoDate } from '$lib/clinicTime';
import {
	LAB_STATUS_LABEL,
	canMoveLabCase,
	isLabCaseStatus,
	isOverdue,
	type LabCaseStatus
} from '$lib/labCaseStatus';
import { isFdiTooth, parseToothRange } from '$lib/teeth';

/**
 * Work sent out to a dental laboratory — a crown, a bridge, a denture — from the docket to the
 * fitting.
 *
 * **The dates are the point.** `sentOn` and `dueOn` are the lab's promise, `receivedOn` what it
 * delivered, `fittedOn` when the patient got it. Each move sets its own date, from the clinic's
 * calendar, so nobody types them and they cannot disagree with the status. The due date is what the
 * person sending says the lab promised, or else the lab's usual turnaround from today.
 *
 * **What moves a case** is `$lib/labCaseStatus.ts`, shared with the screens. A remake sends the
 * same case back and counts the trip (`remakes`); that count, and the gap between due and received,
 * are how a clinic learns which laboratory to keep using (`labPerformance`).
 *
 * Every write is audited (`lab_case` is on the list) and needs `lab_cases.manage`, checked by the
 * caller. A case belongs to a patient — every write is scoped to one — and is filed at the branch
 * it was sent from (§15).
 *
 * Non-goals: paying the laboratory (its fee is recorded, and is an expense like any other), and
 * shipping — which bus the parcel went on is a note, not a column.
 */

/** A transaction on the database, as `db.transaction` hands it over. */
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Reader = Tx | typeof db;

/** What the permission to handle lab work is called. */
export const LAB_PERMISSION = 'lab_cases.manage';

/** A new case, as the form sends it. */
export type LabCaseInput = {
	labId: number;
	procedureId: number | null;
	serviceId: number | null;
	providerId: number | null;
	/** One FDI tooth, or a span like "14-16", when there is no procedure to take it from. */
	teeth: string | null;
	shade: string | null;
	labFee: number | null;
	instructions: string | null;
	/** Sent today, rather than a docket still being prepared. */
	send: boolean;
	/** What the lab promised, `YYYY-MM-DD`; its usual turnaround when not given. */
	dueOn: string | null;
};

/** The lab, live, with its usual turnaround. */
async function checkedLab(tx: Tx, labId: number) {
	const [row] = await tx
		.select({ id: dentalLab.id, turnaround: dentalLab.typicalTurnaroundDays })
		.from(dentalLab)
		.where(and(eq(dentalLab.id, labId), eq(dentalLab.isActive, true), notDeleted(dentalLab)))
		.limit(1);
	refuseUnless(Boolean(row), 'Choose a laboratory from the list.', 'labId');
	return row;
}

/** The date the lab is due to send it back: as promised, or its usual turnaround from today. */
function dueDate(given: string | null, turnaround: number | null): string | null {
	if (given) {
		refuseUnless(isIsoDate(given), 'Choose the date it is due back.', 'dueOn');
		refuseUnless(given >= clinicToday(), 'The date it is due back cannot be in the past.', 'dueOn');
		return given;
	}
	return turnaround ? addClinicDays(clinicToday(), turnaround) : null;
}

/** The teeth a case is for: from its procedure, or as typed. */
async function whereFor(tx: Tx, patientId: number, input: LabCaseInput) {
	if (input.procedureId !== null) {
		const [work] = await tx
			.select({
				toothId: procedures.toothId,
				toothRange: procedures.toothRange,
				serviceId: procedures.serviceId
			})
			.from(procedures)
			.where(
				and(
					eq(procedures.id, input.procedureId),
					eq(procedures.patientId, patientId),
					notDeleted(procedures)
				)
			)
			.limit(1);
		refuseUnless(Boolean(work), 'That treatment is not on this patient’s chart.', 'procedureId');
		return { toothId: work.toothId, toothRange: work.toothRange, serviceId: work.serviceId };
	}
	const typed = input.teeth?.trim() ?? '';
	if (!typed) return { toothId: null, toothRange: null, serviceId: input.serviceId };
	if (/^\d{2}$/.test(typed)) {
		refuseUnless(isFdiTooth(Number(typed)), `${typed} is not a tooth.`, 'teeth');
		return { toothId: Number(typed), toothRange: null, serviceId: input.serviceId };
	}
	const span = parseToothRange(typed);
	if ('error' in span) refuseUnless(false, span.error, 'teeth');
	return {
		toothId: null,
		toothRange: 'teeth' in span ? span.teeth.join(',') : null,
		serviceId: input.serviceId
	};
}

/** Opens a case: a docket in preparation, or sent today. Returns its id. */
export async function openLabCase(
	tx: Tx,
	event: AuditRequest,
	patientId: number,
	input: LabCaseInput
): Promise<number> {
	const lab = await checkedLab(tx, input.labId);
	const where = await whereFor(tx, patientId, input);
	refuseUnless(
		where.serviceId !== null || Boolean(input.instructions?.trim()),
		'Say what is being made — choose the work, or write it on the docket.',
		'serviceId'
	);
	refuseUnless(
		input.labFee === null || input.labFee >= 0,
		'A lab fee cannot be negative.',
		'labFee'
	);
	const today = clinicToday();
	const id = await insertReturningId(tx, labCase, {
		patientId,
		labId: lab.id,
		procedureId: input.procedureId,
		serviceId: where.serviceId,
		providerId: await checkedProvider(tx, input.providerId),
		branchId: event.locals.branch?.active ?? undefined,
		toothId: where.toothId,
		toothRange: where.toothRange,
		shade: input.shade?.trim() || null,
		labFee: input.labFee,
		instructions: input.instructions?.trim() || null,
		status: input.send ? 'sent' : 'draft',
		sentOn: input.send ? today : null,
		dueOn: input.send ? dueDate(input.dueOn, lab.turnaround) : null,
		createdBy: event.locals.user?.id
	});
	await recordAudit(tx, event, { table: 'lab_case', recordId: id, action: 'create' });
	return id;
}

/**
 * Moves a case to its next status, dating the move. Sending or sending back takes the promised
 * date; the rest are today.
 */
export async function moveLabCase(
	tx: Tx,
	event: AuditRequest,
	patientId: number,
	caseId: number,
	to: LabCaseStatus,
	{ dueOn = null }: { dueOn?: string | null } = {}
) {
	const [row] = await tx
		.select()
		.from(labCase)
		.where(and(eq(labCase.id, caseId), eq(labCase.patientId, patientId), notDeleted(labCase)))
		.limit(1)
		.for('update');
	refuseUnless(Boolean(row), 'That lab case is not on this patient’s record.');
	refuseUnless(
		isLabCaseStatus(row.status) && canMoveLabCase(row.status, to),
		`It cannot be marked “${LAB_STATUS_LABEL[to].label.toLowerCase()}” from where it is now.`
	);

	const today = clinicToday();
	const lab = to === 'sent' || to === 'remake' ? await checkedLab(tx, row.labId) : null;
	const values = {
		status: to,
		...(to === 'sent' ? { sentOn: today, dueOn: dueDate(dueOn, lab?.turnaround ?? null) } : {}),
		...(to === 'remake'
			? {
					sentOn: today,
					receivedOn: null,
					dueOn: dueDate(dueOn, lab?.turnaround ?? null),
					remakes: row.remakes + 1
				}
			: {}),
		...(to === 'received' ? { receivedOn: today } : {}),
		...(to === 'fitted' ? { fittedOn: today } : {}),
		updatedBy: event.locals.user?.id
	};
	await tx.update(labCase).set(values).where(eq(labCase.id, caseId));
	await recordAudit(tx, event, {
		table: 'lab_case',
		recordId: caseId,
		action: 'update',
		before: row,
		after: values
	});
}

/** The laboratories a case can be sent to: live and active, with their usual turnaround. */
export async function labOptions() {
	return db
		.select({
			value: dentalLab.id,
			name: dentalLab.name,
			turnaround: dentalLab.typicalTurnaroundDays
		})
		.from(dentalLab)
		.where(and(eq(dentalLab.isActive, true), notDeleted(dentalLab)))
		.orderBy(asc(dentalLab.name));
}

/**
 * The patient's work a case can serve: what is planned or done, not a finding. A crown is sent
 * while it is still planned and fitted when it is done, so both are offered.
 */
export async function labWorkOptions(patientId: number, reader: Reader = db) {
	return reader
		.select({
			value: procedures.id,
			service: services.name,
			serviceId: procedures.serviceId,
			toothId: procedures.toothId,
			surfaces: procedures.surfaces,
			toothRange: procedures.toothRange,
			status: procedures.status
		})
		.from(procedures)
		.leftJoin(services, eq(services.id, procedures.serviceId))
		.where(
			and(
				eq(procedures.patientId, patientId),
				inArray(procedures.status, ['planned', 'completed']),
				notDeleted(procedures)
			)
		)
		.orderBy(desc(procedures.id));
}

/** The columns every lab case list shows. */
function caseColumns() {
	return {
		id: labCase.id,
		patientId: labCase.patientId,
		lab: dentalLab.name,
		labId: labCase.labId,
		work: services.name,
		toothId: labCase.toothId,
		toothRange: labCase.toothRange,
		shade: labCase.shade,
		status: labCase.status,
		sentOn: isoDate(labCase.sentOn),
		dueOn: isoDate(labCase.dueOn),
		receivedOn: isoDate(labCase.receivedOn),
		fittedOn: isoDate(labCase.fittedOn),
		remakes: labCase.remakes,
		labFee: labCase.labFee,
		instructions: labCase.instructions,
		provider: providerName
	};
}

/** Adds what a screen shows but the database does not keep: whether it is overdue. */
function withOverdue<T extends { status: string; dueOn: string | null }>(rows: T[]) {
	const today = clinicToday();
	return rows.map((row) => ({
		...row,
		overdue:
			isLabCaseStatus(row.status) && isOverdue({ status: row.status, dueOn: row.dueOn }, today)
	}));
}

/** One patient's lab cases, newest first. Every branch's — the chart is the patient's (§15). */
export async function patientLabCases(patientId: number, reader: Reader = db) {
	const rows = await reader
		.select(caseColumns())
		.from(labCase)
		.innerJoin(dentalLab, eq(dentalLab.id, labCase.labId))
		.leftJoin(services, eq(services.id, labCase.serviceId))
		.leftJoin(provider, eq(provider.id, labCase.providerId))
		.leftJoin(providerEmployee, eq(providerEmployee.id, provider.employeeId))
		.where(and(eq(labCase.patientId, patientId), notDeleted(labCase)))
		.orderBy(desc(labCase.id));
	return withOverdue(rows);
}

/**
 * The board: every case at this branch not yet finished — being prepared, out at a lab, or back and
 * waiting to be fitted — with its patient.
 */
export async function labBoard(branch: Pick<BranchContext, 'active'>) {
	const rows = await db
		.select({ ...caseColumns(), patient: patientFullName, phone: patient.phone })
		.from(labCase)
		.innerJoin(dentalLab, eq(dentalLab.id, labCase.labId))
		.innerJoin(patient, and(eq(patient.id, labCase.patientId), livePatient()))
		.leftJoin(services, eq(services.id, labCase.serviceId))
		.leftJoin(provider, eq(provider.id, labCase.providerId))
		.leftJoin(providerEmployee, eq(providerEmployee.id, provider.employeeId))
		.where(
			and(
				notInArray(labCase.status, ['fitted', 'cancelled']),
				notDeleted(labCase),
				branchFilter(labCase.branchId, branch)
			)
		)
		.orderBy(labCase.dueOn, labCase.id);
	return withOverdue(rows);
}

/**
 * How each laboratory has done with the work sent in a window — the last year unless the clinic
 * report asks for its own range: cases, how many came back late and by how many days on average,
 * and how many went back for a remake. Worked out here from the dates rather than in SQL, whose
 * date arithmetic is spelled differently on every engine (§10).
 */
export async function labPerformance(
	branch: Pick<BranchContext, 'active'>,
	reader: Reader = db,
	range: { from: string; to: string } = {
		from: addClinicDays(clinicToday(), -365),
		to: clinicToday()
	}
) {
	const rows = await reader
		.select({
			labId: dentalLab.id,
			lab: dentalLab.name,
			promised: dentalLab.typicalTurnaroundDays,
			sentOn: isoDate(labCase.sentOn),
			dueOn: isoDate(labCase.dueOn),
			receivedOn: isoDate(labCase.receivedOn),
			remakes: labCase.remakes
		})
		.from(labCase)
		.innerJoin(dentalLab, eq(dentalLab.id, labCase.labId))
		.where(
			and(
				inArray(labCase.status, ['received', 'fitted', 'remake']),
				notDeleted(labCase),
				branchFilter(labCase.branchId, branch)
			)
		);

	const days = (from: string, to: string) =>
		Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
	const byLab = new Map<
		number,
		{
			lab: string;
			promised: number | null;
			cases: number;
			late: number;
			lateDays: number;
			turnaround: number[];
			remakes: number;
		}
	>();
	for (const row of rows) {
		if (!row.sentOn || row.sentOn < range.from || row.sentOn > range.to) continue;
		const entry = byLab.get(row.labId) ?? {
			lab: row.lab,
			promised: row.promised,
			cases: 0,
			late: 0,
			lateDays: 0,
			turnaround: [],
			remakes: 0
		};
		entry.cases++;
		entry.remakes += row.remakes;
		if (row.receivedOn) {
			entry.turnaround.push(days(row.sentOn, row.receivedOn));
			if (row.dueOn && row.receivedOn > row.dueOn) {
				entry.late++;
				entry.lateDays += days(row.dueOn, row.receivedOn);
			}
		}
		byLab.set(row.labId, entry);
	}
	return [...byLab.values()].map((e) => ({
		lab: e.lab,
		promised: e.promised,
		cases: e.cases,
		averageDays: e.turnaround.length
			? Math.round(e.turnaround.reduce((s, d) => s + d, 0) / e.turnaround.length)
			: null,
		late: e.late,
		averageLateDays: e.late ? Math.round(e.lateDays / e.late) : null,
		remakes: e.remakes
	}));
}

/**
 * For the day view: each patient's lab work that matters to today's visit — back and ready to
 * fit, or still out (and whether overdue). One query for every patient on the day.
 */
export async function labStatusFor(patientIds: number[]) {
	const result = new Map<number, { ready: number; out: number; overdue: number }>();
	if (!patientIds.length) return result;
	const rows = await db
		.select({ patientId: labCase.patientId, status: labCase.status, dueOn: isoDate(labCase.dueOn) })
		.from(labCase)
		.where(
			and(
				inArray(labCase.patientId, patientIds),
				inArray(labCase.status, ['sent', 'remake', 'received']),
				notDeleted(labCase)
			)
		);
	const today = clinicToday();
	for (const row of rows) {
		const entry = result.get(row.patientId) ?? { ready: 0, out: 0, overdue: 0 };
		if (row.status === 'received') entry.ready++;
		else {
			entry.out++;
			if (
				isLabCaseStatus(row.status) &&
				isOverdue({ status: row.status, dueOn: row.dueOn }, today)
			) {
				entry.overdue++;
			}
		}
		result.set(row.patientId, entry);
	}
	return result;
}

/**
 * Whose case this is, when it is moved from the board rather than from the patient's chart — and
 * only if it is at a branch the caller may see (§15). Null when it is neither.
 */
export async function labCaseOwner(
	caseId: number,
	branch: Pick<BranchContext, 'active'>
): Promise<number | null> {
	const [row] = await db
		.select({ patientId: labCase.patientId })
		.from(labCase)
		.where(and(eq(labCase.id, caseId), notDeleted(labCase), branchFilter(labCase.branchId, branch)))
		.limit(1);
	return row?.patientId ?? null;
}

/**
 * The move action, shared by the lab board and the patient's Lab work tab: under
 * `lab_cases.manage`, in a transaction, with a refusal shown as the reason. `owner` finds the
 * patient — from the chart's path, or from the case on the board.
 */
export function moveLabAction(event: RequestEvent, owner: (caseId: number) => Promise<number>) {
	return ownedAction(
		event,
		LAB_PERMISSION,
		moveLabCaseForm,
		(data) => owner(data.caseId),
		async (tx, { ownerId, data }) => {
			await moveLabCase(tx, event, ownerId, data.caseId, data.to, { dueOn: data.dueOn || null });
			return `Marked “${LAB_STATUS_LABEL[data.to].label.toLowerCase()}”.`;
		}
	);
}
