/**
 * Periodontal exams: starting one, saving its readings, finishing it, and reading a patient's
 * history of them with each compared against the one before.
 *
 * The rules for a reading are `$lib/perio.ts`, shared with the grid; this module owns storage and
 * the record's own rules:
 *
 *   - **one draft at a time per patient.** Two open charts for one mouth is two half-charts, and the
 *     comparison would not know which to trust.
 *   - **a finished exam is fixed** (see the schema). Saving, finishing and discarding all refuse one.
 *   - **anyone with `patients.clinical` may fill a draft in**, not only whoever started it: the
 *     dentist probes and calls the numbers, the assistant types them.
 *   - a new exam starts with the teeth the dental chart says are gone already marked missing, so
 *     nobody probes a gap.
 *
 * Audit (CLAUDE.md §11): a save is one row on the exam — the notes if they moved, and how many
 * readings changed — never 192 rows for 192 sites.
 *
 * Non-goals: comparing anything but the previous finished exam (the list shows the trend across
 * all of them).
 */
import { and, desc, eq, inArray, isNotNull, isNull, lt, or } from 'drizzle-orm';

import { db } from '$lib/server/db';
import { branch, perioExam, perioSite, perioTooth, provider } from '$lib/server/db/schema';
import { insertReturningId } from '@nahu/admin-kit/server/db/insert.js';
import { notDeleted, softDeleteOwnedRecord } from '$lib/server/softDelete';
import { recordAudit, type AuditRequest } from '$lib/server/audit';
import { refuseUnless } from '$lib/server/childCrud';
import {
	checkedProvider,
	checkedVisit,
	providerEmployee,
	providerName
} from '$lib/server/appointments';
import { chartProcedures } from '$lib/server/procedures';
import { clinicToday } from '$lib/clinicTime';
import { toothStates } from '$lib/teeth';
import {
	PERIO_SITES,
	PERIO_TEETH,
	attachmentChanges,
	changeCounts,
	emptyTooth,
	perioProblem,
	perioSummary,
	type ToothReading
} from '$lib/perio';

/** A transaction on the database, as `db.transaction` hands it over. */
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Who may chart gums: the same as any other clinical write. */
export const PERIO_PERMISSION = 'patients.clinical';

/** The readings of some exams, each as the 32 teeth `$lib/perio.ts` describes. */
async function readingsOf(
	examIds: number[],
	reader: Tx | typeof db = db
): Promise<Map<number, ToothReading[]>> {
	const out = new Map<number, ToothReading[]>();
	if (!examIds.length) return out;

	const [teeth, sites] = await Promise.all([
		reader.select().from(perioTooth).where(inArray(perioTooth.examId, examIds)),
		reader.select().from(perioSite).where(inArray(perioSite.examId, examIds))
	]);

	const byExam = new Map<number, Map<number, ToothReading>>();
	const toothIn = (examId: number, code: number) => {
		const exam = byExam.get(examId) ?? new Map<number, ToothReading>();
		byExam.set(examId, exam);
		const reading = exam.get(code) ?? emptyTooth(code);
		exam.set(code, reading);
		return reading;
	};
	for (const t of teeth) {
		const reading = toothIn(t.examId, t.toothId);
		reading.missing = t.missing;
		reading.mobility = t.mobility;
		reading.furcation = t.furcation;
	}
	for (const s of sites) {
		toothIn(s.examId, s.toothId).sites[s.site] = {
			depth: s.depth,
			recession: s.recession,
			bleeding: s.bleeding,
			plaque: s.plaque
		};
	}
	for (const id of examIds) {
		const exam = byExam.get(id) ?? new Map<number, ToothReading>();
		out.set(
			id,
			PERIO_TEETH.map((code) => exam.get(code) ?? emptyTooth(code))
		);
	}
	return out;
}

const examColumns = {
	id: perioExam.id,
	examinedOn: perioExam.examinedOn,
	completedAt: perioExam.completedAt,
	notes: perioExam.notes,
	providerId: perioExam.providerId,
	provider: providerName,
	appointmentId: perioExam.appointmentId
};

/**
 * A patient's exams, newest first, each added up and compared with the finished exam before it.
 * A draft is compared too — it is what the clinician is looking at while charting.
 */
export async function perioExams(patientId: number) {
	const exams = await db
		.select(examColumns)
		.from(perioExam)
		.leftJoin(provider, eq(provider.id, perioExam.providerId))
		.leftJoin(providerEmployee, eq(providerEmployee.id, provider.employeeId))
		.where(and(eq(perioExam.patientId, patientId), notDeleted(perioExam)))
		.orderBy(desc(perioExam.examinedOn), desc(perioExam.id));

	const readings = await readingsOf(exams.map((e) => e.id));
	return exams.map((exam, i) => {
		const teeth = readings.get(exam.id) ?? [];
		const earlier = exams.slice(i + 1).find((e) => e.completedAt);
		const changes = earlier
			? changeCounts(attachmentChanges(readings.get(earlier.id) ?? [], teeth))
			: null;
		return { ...exam, summary: perioSummary(teeth), changes, comparedWith: earlier?.examinedOn };
	});
}

/** One row of `perioExams`. */
export type PerioExamRow = Awaited<ReturnType<typeof perioExams>>[number];

/**
 * One exam with its readings, and the finished exam before it to compare with — or null when the
 * exam is not this patient's.
 */
export async function perioExamDetail(patientId: number, examId: number) {
	// The branch it was taken at heads the printout, as a quote is headed by its own.
	const [exam] = await db
		.select({
			...examColumns,
			branch: branch.name,
			branchAddress: branch.address,
			branchPhone: branch.phone
		})
		.from(perioExam)
		.leftJoin(provider, eq(provider.id, perioExam.providerId))
		.leftJoin(providerEmployee, eq(providerEmployee.id, provider.employeeId))
		.leftJoin(branch, eq(branch.id, perioExam.branchId))
		.where(and(eq(perioExam.id, examId), eq(perioExam.patientId, patientId), notDeleted(perioExam)))
		.limit(1);
	if (!exam) return null;

	// The last finished exam taken before this one: on an earlier day, or earlier the same day.
	const [previous] = await db
		.select({ id: perioExam.id, examinedOn: perioExam.examinedOn })
		.from(perioExam)
		.where(
			and(
				eq(perioExam.patientId, patientId),
				notDeleted(perioExam),
				isNotNull(perioExam.completedAt),
				or(
					lt(perioExam.examinedOn, exam.examinedOn),
					and(eq(perioExam.examinedOn, exam.examinedOn), lt(perioExam.id, exam.id))
				)
			)
		)
		.orderBy(desc(perioExam.examinedOn), desc(perioExam.id))
		.limit(1);

	const readings = await readingsOf(previous ? [exam.id, previous.id] : [exam.id]);
	return {
		exam,
		teeth: readings.get(exam.id) ?? [],
		previous: previous
			? { examinedOn: previous.examinedOn, teeth: readings.get(previous.id) ?? [] }
			: null
	};
}

/** The exam, locked for the write, if it is this patient's and still a draft. */
async function draftFor(tx: Tx, patientId: number, examId: number) {
	const [exam] = await tx
		.select({ id: perioExam.id, completedAt: perioExam.completedAt, notes: perioExam.notes })
		.from(perioExam)
		.where(and(eq(perioExam.id, examId), eq(perioExam.patientId, patientId), notDeleted(perioExam)))
		.limit(1)
		.for('update');
	refuseUnless(Boolean(exam), 'That exam is not on this patient’s record.');
	refuseUnless(
		!exam.completedAt,
		'This exam is finished and cannot be changed. Chart again to record new readings.'
	);
	return exam;
}

/**
 * Starts an exam: the 32 adult teeth, those the dental chart says are gone marked missing. Refused
 * while the patient has another draft open.
 */
export async function startExam(
	tx: Tx,
	event: AuditRequest & { locals: { branch?: { active: number | null } } },
	patientId: number,
	input: { providerId: number | null; appointmentId: number | null }
): Promise<number> {
	const [open] = await tx
		.select({ id: perioExam.id })
		.from(perioExam)
		.where(
			and(eq(perioExam.patientId, patientId), isNull(perioExam.completedAt), notDeleted(perioExam))
		)
		.limit(1)
		.for('update');
	refuseUnless(
		!open,
		'This patient already has an exam being charted. Finish or discard it first.'
	);

	const providerId = await checkedProvider(tx, input.providerId);
	const appointmentId = await checkedVisit(tx, patientId, input.appointmentId);
	const id = await insertReturningId(tx, perioExam, {
		patientId,
		providerId,
		appointmentId,
		examinedOn: clinicToday(),
		branchId: event.locals.branch?.active ?? undefined,
		createdBy: event.locals.user?.id
	});

	const states = toothStates(await chartProcedures(patientId));
	await tx.insert(perioTooth).values(
		PERIO_TEETH.map((toothId) => ({
			examId: id,
			toothId,
			missing: states.get(toothId)?.missing ?? false
		}))
	);
	await tx
		.insert(perioSite)
		.values(
			PERIO_TEETH.flatMap((toothId) => PERIO_SITES.map((site) => ({ examId: id, toothId, site })))
		);

	await recordAudit(tx, event, { table: 'perio_exam', recordId: id, action: 'create' });
	return id;
}

const sameSite = (
	a: { depth: number | null; recession: number | null; bleeding: boolean; plaque: boolean },
	b: typeof a
) =>
	a.depth === b.depth &&
	a.recession === b.recession &&
	a.bleeding === b.bleeding &&
	a.plaque === b.plaque;

/**
 * Saves a draft's readings and notes. Only what changed is written; the audit row says how many
 * readings that was. Returns the count.
 */
export async function saveReadings(
	tx: Tx,
	event: AuditRequest,
	patientId: number,
	examId: number,
	input: { teeth: ToothReading[]; notes: string | null }
): Promise<number> {
	const exam = await draftFor(tx, patientId, examId);
	const problem = perioProblem(input.teeth);
	refuseUnless(problem === null, problem ?? '');

	const stored = await readingsOf([examId], tx);
	const before = new Map((stored.get(examId) ?? []).map((t) => [t.tooth, t]));
	const [toothRows, siteRows] = await Promise.all([
		tx
			.select({ id: perioTooth.id, toothId: perioTooth.toothId })
			.from(perioTooth)
			.where(eq(perioTooth.examId, examId)),
		tx
			.select({ id: perioSite.id, toothId: perioSite.toothId, site: perioSite.site })
			.from(perioSite)
			.where(eq(perioSite.examId, examId))
	]);
	const toothRowId = new Map(toothRows.map((r) => [r.toothId, r.id]));
	const siteRowId = new Map(siteRows.map((r) => [`${r.toothId}${r.site}`, r.id]));

	let changed = 0;
	for (const reading of input.teeth) {
		const was = before.get(reading.tooth) ?? emptyTooth(reading.tooth);
		const toothId = toothRowId.get(reading.tooth);
		if (
			toothId !== undefined &&
			(was.missing !== reading.missing ||
				was.mobility !== reading.mobility ||
				was.furcation !== reading.furcation)
		) {
			await tx
				.update(perioTooth)
				.set({ missing: reading.missing, mobility: reading.mobility, furcation: reading.furcation })
				.where(eq(perioTooth.id, toothId));
			changed++;
		}
		for (const site of PERIO_SITES) {
			const now = reading.sites[site];
			if (sameSite(was.sites[site], now)) continue;
			const rowId = siteRowId.get(`${reading.tooth}${site}`);
			if (rowId === undefined) continue;
			await tx
				.update(perioSite)
				.set({
					depth: now.depth,
					recession: now.recession,
					bleeding: now.bleeding,
					plaque: now.plaque
				})
				.where(eq(perioSite.id, rowId));
			changed++;
		}
	}

	const notes = input.notes?.trim() || null;
	if (notes !== exam.notes) {
		await tx
			.update(perioExam)
			.set({ notes, updatedBy: event.locals.user?.id })
			.where(eq(perioExam.id, examId));
	}
	await recordAudit(tx, event, {
		table: 'perio_exam',
		recordId: examId,
		action: 'update',
		before: { notes: exam.notes },
		after: { notes },
		...(changed ? { detail: { readingsChanged: changed } } : {})
	});
	return changed;
}

/** Finishes a draft, after which it is the baseline the next exam is compared with. */
export async function finishExam(tx: Tx, event: AuditRequest, patientId: number, examId: number) {
	await draftFor(tx, patientId, examId);
	const readings = (await readingsOf([examId], tx)).get(examId) ?? [];
	refuseUnless(
		perioSummary(readings).sitesMeasured > 0,
		'Nothing has been measured yet. Save the readings before finishing.'
	);
	const after = { completedAt: new Date(), updatedBy: event.locals.user?.id };
	await tx.update(perioExam).set(after).where(eq(perioExam.id, examId));
	await recordAudit(tx, event, {
		table: 'perio_exam',
		recordId: examId,
		action: 'update',
		before: { completedAt: null },
		after: { completedAt: after.completedAt }
	});
}

/** Discards a draft. Its readings stay with it, unread, as a deleted exam's do. */
export async function discardExam(tx: Tx, event: AuditRequest, patientId: number, examId: number) {
	await draftFor(tx, patientId, examId);
	await softDeleteOwnedRecord(
		tx,
		perioExam,
		perioExam.patientId,
		examId,
		patientId,
		event.locals.user?.id
	);
	await recordAudit(tx, event, { table: 'perio_exam', recordId: examId, action: 'delete' });
}
