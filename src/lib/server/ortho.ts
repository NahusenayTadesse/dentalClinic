/**
 * Orthodontic cases: opening one with its payment plan, recording adjustment visits, moving it to
 * retention or closing it, and billing the instalments that have fallen due. The rules are
 * `$lib/orthoPlan.ts`'s.
 *
 *   - the plan is fixed when the case opens: its instalments are rows from then on, billed one by
 *     one as an ordinary bill (`createInvoice` with a charge, then `issueInvoice`), so a payment
 *     against one is taken, receipted and reported like any other
 *   - billing is a person's step, not a timer: "bill what is due" on the case or the board, by
 *     someone with `billing.invoice`, so nothing is invoiced on a day nobody is at the desk
 *   - a discontinued case cancels its unbilled instalments; what was billed stays owed
 *   - a finished or discontinued case takes no more visits
 *
 * Audit (§11): a case's opening and each change of status, each visit, and each instalment billed.
 *
 * Non-goals: changing the fee or schedule after the start (see `$lib/orthoPlan.ts`), and booking
 * the next adjustment — the visit says when, and the diary books it.
 */
import { and, asc, desc, eq, inArray, isNull, lte } from 'drizzle-orm';

import { db } from '$lib/server/db';
import {
	invoice,
	orthoCase,
	orthoInstalment,
	orthoVisit,
	patient,
	provider
} from '$lib/server/db/schema';
import { insertReturningId } from '@nahu/admin-kit/server/db/insert.js';
import { notDeleted, softDeleteOrthoInstalments } from '$lib/server/softDelete';
import { recordAudit, type AuditRequest } from '$lib/server/audit';
import { refuseUnless } from '$lib/server/childCrud';
import {
	checkedProvider,
	checkedVisit,
	providerEmployee,
	providerName
} from '$lib/server/appointments';
import { createInvoice, issueInvoice } from '$lib/server/invoiceWrites';
import { branchFilter, type BranchContext } from '$lib/server/branchScope';
import { patientFullName } from '$lib/server/patients';
import { clinicToday } from '$lib/clinicTime';
import {
	caseProgress,
	instalmentSchedule,
	instalmentState,
	planProblem,
	type Appliance,
	type OrthoStatus
} from '$lib/orthoPlan';

/** A transaction on the database, as `db.transaction` hands it over. */
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Opening a case and recording its visits: a clinical write. */
export const ORTHO_PERMISSION = 'patients.clinical';
/** Billing its instalments: a billing one. */
export const ORTHO_BILLING_PERMISSION = 'billing.invoice';

/** The instalments of some cases, each with its bill's number and status. */
async function instalmentsOf(caseIds: number[], reader: Tx | typeof db = db) {
	if (!caseIds.length) return [];
	return reader
		.select({
			id: orthoInstalment.id,
			caseId: orthoInstalment.caseId,
			n: orthoInstalment.n,
			dueOn: orthoInstalment.dueOn,
			amount: orthoInstalment.amount,
			invoiceId: orthoInstalment.invoiceId,
			invoiceNumber: invoice.invoiceNumber,
			billStatus: invoice.status
		})
		.from(orthoInstalment)
		.leftJoin(invoice, eq(invoice.id, orthoInstalment.invoiceId))
		.where(and(inArray(orthoInstalment.caseId, caseIds), notDeleted(orthoInstalment)))
		.orderBy(asc(orthoInstalment.caseId), asc(orthoInstalment.n));
}

/** What a case's instalments add up to: paid, owed on bills, due unbilled, and the next one. */
function money(rows: Awaited<ReturnType<typeof instalmentsOf>>, today: string) {
	const states = rows.map((r) => ({
		...r,
		state: instalmentState(r, r.billStatus ? { status: r.billStatus } : null, today)
	}));
	const sumOf = (s: string[]) =>
		states.filter((r) => s.includes(r.state)).reduce((sum, r) => sum + r.amount, 0);
	return {
		instalments: states,
		paid: sumOf(['paid']),
		owed: sumOf(['billed', 'overdue']),
		dueUnbilled: states.filter((r) => r.state === 'due').length,
		overdue: states.filter((r) => r.state === 'overdue').length,
		next: states.find((r) => r.state === 'upcoming') ?? null
	};
}

const caseColumns = {
	id: orthoCase.id,
	patientId: orthoCase.patientId,
	appliance: orthoCase.appliance,
	startedOn: orthoCase.startedOn,
	plannedMonths: orthoCase.plannedMonths,
	totalFee: orthoCase.totalFee,
	deposit: orthoCase.deposit,
	instalmentCount: orthoCase.instalments,
	status: orthoCase.status,
	endedOn: orthoCase.endedOn,
	notes: orthoCase.notes,
	providerId: orthoCase.providerId,
	provider: providerName
};

/** A patient's cases, newest first, each with its progress and money. */
export async function orthoCases(patientId: number) {
	const cases = await db
		.select(caseColumns)
		.from(orthoCase)
		.leftJoin(provider, eq(provider.id, orthoCase.providerId))
		.leftJoin(providerEmployee, eq(providerEmployee.id, provider.employeeId))
		.where(and(eq(orthoCase.patientId, patientId), notDeleted(orthoCase)))
		.orderBy(desc(orthoCase.startedOn), desc(orthoCase.id));
	const today = clinicToday();
	const all = await instalmentsOf(cases.map((c) => c.id));
	return cases.map((c) => ({
		...c,
		progress: caseProgress(c.startedOn, c.plannedMonths, c.endedOn ?? today),
		...money(
			all.filter((i) => i.caseId === c.id),
			today
		)
	}));
}

/** One case with its visits, or null when it is not this patient's. */
export async function orthoCaseDetail(patientId: number, caseId: number) {
	const [found] = (await orthoCases(patientId)).filter((c) => c.id === caseId);
	if (!found) return null;
	const visits = await db
		.select({
			id: orthoVisit.id,
			visitedOn: orthoVisit.visitedOn,
			work: orthoVisit.work,
			nextInWeeks: orthoVisit.nextInWeeks,
			note: orthoVisit.note,
			provider: providerName
		})
		.from(orthoVisit)
		.leftJoin(provider, eq(provider.id, orthoVisit.providerId))
		.leftJoin(providerEmployee, eq(providerEmployee.id, provider.employeeId))
		.where(and(eq(orthoVisit.caseId, caseId), notDeleted(orthoVisit)))
		.orderBy(desc(orthoVisit.visitedOn), desc(orthoVisit.id));
	return { case: found, visits };
}

/** The case, locked, if it is this patient's. */
async function caseFor(tx: Tx, patientId: number, caseId: number) {
	const [row] = await tx
		.select({
			id: orthoCase.id,
			status: orthoCase.status,
			providerId: orthoCase.providerId,
			branchId: orthoCase.branchId,
			instalments: orthoCase.instalments
		})
		.from(orthoCase)
		.where(and(eq(orthoCase.id, caseId), eq(orthoCase.patientId, patientId), notDeleted(orthoCase)))
		.limit(1)
		.for('update');
	refuseUnless(Boolean(row), 'That case is not on this patient’s record.');
	return row;
}

/** What opening a case needs. */
export type NewCase = {
	providerId: number | null;
	appliance: Appliance;
	startedOn: string;
	plannedMonths: number;
	totalFee: number;
	deposit: number;
	instalments: number;
	notes: string | null;
};

/** Opens a case and writes its payment plan. Returns the case's id. */
export async function openCase(
	tx: Tx,
	event: AuditRequest & { locals: { branch?: { active: number | null } } },
	patientId: number,
	input: NewCase
): Promise<number> {
	const problem = planProblem({
		totalFee: input.totalFee,
		deposit: input.deposit,
		count: input.instalments
	});
	refuseUnless(problem === null, problem ?? '', 'totalFee');
	refuseUnless(
		input.plannedMonths >= 1 && input.plannedMonths <= 72,
		'Plan between one month and six years.',
		'plannedMonths'
	);
	const providerId = await checkedProvider(tx, input.providerId);
	const id = await insertReturningId(tx, orthoCase, {
		patientId,
		providerId,
		branchId: event.locals.branch?.active ?? undefined,
		appliance: input.appliance,
		startedOn: input.startedOn,
		plannedMonths: input.plannedMonths,
		totalFee: input.totalFee,
		deposit: input.deposit,
		instalments: input.instalments,
		notes: input.notes,
		createdBy: event.locals.user?.id
	});
	const plan = instalmentSchedule({
		totalFee: input.totalFee,
		deposit: input.deposit,
		count: input.instalments,
		startedOn: input.startedOn
	});
	if (plan.length) {
		await tx
			.insert(orthoInstalment)
			.values(plan.map((p) => ({ ...p, caseId: id, createdBy: event.locals.user?.id })));
	}
	await recordAudit(tx, event, {
		table: 'ortho_case',
		recordId: id,
		action: 'create',
		detail: { totalFee: input.totalFee, instalments: plan.length }
	});
	return id;
}

/** Records an adjustment visit on a case still being seen. */
export async function recordOrthoVisit(
	tx: Tx,
	event: AuditRequest,
	patientId: number,
	caseId: number,
	input: {
		visitedOn: string;
		work: string;
		nextInWeeks: number | null;
		note: string | null;
		providerId: number | null;
		appointmentId: number | null;
	}
) {
	const found = await caseFor(tx, patientId, caseId);
	refuseUnless(
		found.status === 'active' || found.status === 'retention',
		'This case is closed. Open a new one to treat again.'
	);
	refuseUnless(
		input.visitedOn <= clinicToday(),
		'A visit is recorded after it happens.',
		'visitedOn'
	);
	const id = await insertReturningId(tx, orthoVisit, {
		caseId,
		visitedOn: input.visitedOn,
		work: input.work.trim().slice(0, 255),
		nextInWeeks: input.nextInWeeks,
		note: input.note,
		providerId: await checkedProvider(tx, input.providerId ?? found.providerId),
		appointmentId: await checkedVisit(tx, patientId, input.appointmentId),
		createdBy: event.locals.user?.id
	});
	await recordAudit(tx, event, { table: 'ortho_visit', recordId: id, action: 'create' });
}

/** The moves a case may make from where it is. */
const NEXT: Record<OrthoStatus, OrthoStatus[]> = {
	active: ['retention', 'finished', 'discontinued'],
	retention: ['finished', 'discontinued'],
	finished: [],
	discontinued: []
};

/** The statuses a case can move to next — for the buttons. */
export const nextStatuses = (status: OrthoStatus) => NEXT[status];

/**
 * Moves a case on: braces off into retention, finished, or discontinued. Discontinuing cancels
 * the instalments not yet billed; what was billed is still owed.
 */
export async function setOrthoStatus(
	tx: Tx,
	event: AuditRequest,
	patientId: number,
	caseId: number,
	status: OrthoStatus
) {
	const found = await caseFor(tx, patientId, caseId);
	refuseUnless(NEXT[found.status].includes(status), 'A case cannot move that way.');
	const ended = status === 'finished' || status === 'discontinued';
	const after = {
		status,
		endedOn: ended ? clinicToday() : null,
		updatedBy: event.locals.user?.id
	};
	await tx.update(orthoCase).set(after).where(eq(orthoCase.id, caseId));
	let cancelled = 0;
	if (status === 'discontinued') {
		const unbilled = await tx
			.select({ id: orthoInstalment.id })
			.from(orthoInstalment)
			.where(
				and(
					eq(orthoInstalment.caseId, caseId),
					isNull(orthoInstalment.invoiceId),
					notDeleted(orthoInstalment)
				)
			);
		if (unbilled.length) {
			await softDeleteOrthoInstalments(
				tx,
				unbilled.map((u) => u.id),
				event.locals.user?.id
			);
			cancelled = unbilled.length;
		}
	}
	await recordAudit(tx, event, {
		table: 'ortho_case',
		recordId: caseId,
		action: 'update',
		before: { status: found.status },
		after: { status },
		...(cancelled ? { detail: { instalmentsCancelled: cancelled } } : {})
	});
}

/**
 * Bills a case's instalments that have fallen due and are not yet billed: one issued bill each,
 * due on the instalment's own date. Returns how many were billed.
 */
export async function billDueInstalments(
	tx: Tx,
	event: AuditRequest & { locals: { branch?: { active: number | null } } },
	patientId: number,
	caseId: number
): Promise<number> {
	const found = await caseFor(tx, patientId, caseId);
	refuseUnless(
		found.status !== 'discontinued',
		'This case was discontinued; nothing more is billed.'
	);
	const due = await tx
		.select({
			id: orthoInstalment.id,
			n: orthoInstalment.n,
			dueOn: orthoInstalment.dueOn,
			amount: orthoInstalment.amount
		})
		.from(orthoInstalment)
		.where(
			and(
				eq(orthoInstalment.caseId, caseId),
				isNull(orthoInstalment.invoiceId),
				lte(orthoInstalment.dueOn, clinicToday()),
				notDeleted(orthoInstalment)
			)
		)
		.orderBy(asc(orthoInstalment.n))
		.for('update');
	refuseUnless(due.length > 0, 'Nothing is due to bill yet.');

	for (const instalment of due) {
		const description =
			instalment.n === 0
				? 'Orthodontic treatment — deposit'
				: `Orthodontic treatment — instalment ${instalment.n} of ${found.instalments}`;
		const invoiceId = await createInvoice(tx, event, {
			patientId,
			procedureIds: [],
			branchId: found.branchId ?? event.locals.branch?.active ?? null,
			providerId: found.providerId,
			charges: [{ description, quantity: 1, unitPrice: instalment.amount }]
		});
		await issueInvoice(tx, event, patientId, invoiceId, { dueOn: instalment.dueOn });
		await tx
			.update(orthoInstalment)
			.set({ invoiceId, updatedBy: event.locals.user?.id })
			.where(eq(orthoInstalment.id, instalment.id));
		await recordAudit(tx, event, {
			table: 'ortho_instalment',
			recordId: instalment.id,
			action: 'update',
			before: { invoiceId: null },
			after: { invoiceId }
		});
	}
	return due.length;
}

/**
 * Every case still being seen at the branch, for the front desk's board: who, what, how far along,
 * what is owed and what is due to bill.
 */
export async function orthoBoard(scope: Pick<BranchContext, 'active'>) {
	const cases = await db
		.select({
			...caseColumns,
			patient: patientFullName,
			fileNo: patient.fileNo,
			phone: patient.phone
		})
		.from(orthoCase)
		.innerJoin(patient, eq(patient.id, orthoCase.patientId))
		.leftJoin(provider, eq(provider.id, orthoCase.providerId))
		.leftJoin(providerEmployee, eq(providerEmployee.id, provider.employeeId))
		.where(
			and(
				inArray(orthoCase.status, ['active', 'retention']),
				notDeleted(orthoCase),
				branchFilter(orthoCase.branchId, scope)
			)
		)
		.orderBy(asc(orthoCase.startedOn));
	const today = clinicToday();
	const all = await instalmentsOf(cases.map((c) => c.id));
	const lastVisits = cases.length
		? await db
				.select({
					caseId: orthoVisit.caseId,
					visitedOn: orthoVisit.visitedOn,
					nextInWeeks: orthoVisit.nextInWeeks
				})
				.from(orthoVisit)
				.where(
					and(
						inArray(
							orthoVisit.caseId,
							cases.map((c) => c.id)
						),
						notDeleted(orthoVisit)
					)
				)
				.orderBy(desc(orthoVisit.visitedOn), desc(orthoVisit.id))
		: [];
	return cases.map((c) => {
		const m = money(
			all.filter((i) => i.caseId === c.id),
			today
		);
		return {
			...c,
			paid: m.paid,
			owed: m.owed,
			dueUnbilled: m.dueUnbilled,
			overdue: m.overdue,
			next: m.next,
			progress: caseProgress(c.startedOn, c.plannedMonths, today),
			lastVisit: lastVisits.find((v) => v.caseId === c.id) ?? null
		};
	});
}

/** One row of the board. */
export type OrthoBoardRow = Awaited<ReturnType<typeof orthoBoard>>[number];
