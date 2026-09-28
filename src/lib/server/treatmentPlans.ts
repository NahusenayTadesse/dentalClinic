/**
 * Treatment plans: what a patient was offered, and what they said — the queries the three plan
 * screens share, and every write to a plan.
 *
 * **A plan quotes charted work.** Its lines are made from the patient's `planned` procedures, and
 * each line **snapshots** what the patient is told — the description and the price — at the moment
 * it is made. After that the line is never read back through the procedure: re-pricing a crown
 * next year cannot change what somebody was quoted this year (see `treatmentPlanItem`).
 *
 * **A presented quote can be corrected, and the correction is kept.** A draft changes freely.
 * Once presented, a change — re-pricing, rewording, adding or removing a line — needs a reason and
 * writes a row to `treatment_plan_adjustment`, which is never updated or deleted, so what the
 * patient was first told can always be read back (`planAdjustments`, `originalTotal`).
 *
 * **One plan per piece of work at a time.** A planned procedure already on an open plan — a draft,
 * one awaiting an answer, or one accepted and not finished — is not offered for another. An expired
 * or declined plan lets its work go, so it can be quoted again at today's price.
 *
 * **Every write is checked here, not trusted from the form.** The plan must be this patient's, in a
 * status that allows the step (`$lib/treatmentPlanStatus.ts`), and every line or procedure id must
 * belong to it. A refusal is a `WriteRefused` — a 400 with a reason, not a 500 — and every write is
 * audited in its own transaction (CLAUDE.md §11).
 *
 * Non-goals:
 *   - **Changing the procedures.** Declining a line leaves its procedure planned: the patient may
 *     come back to it, and a later plan can quote it again. The chart is what was found and done;
 *     the plan is what was said about it.
 *   - **Booking.** An accepted plan does not make appointments; the front desk books from it.
 *   - **Billing.** An invoice is raised from work done, not from a quote.
 */
import {
	and,
	asc,
	desc,
	eq,
	gte,
	inArray,
	isNotNull,
	isNull,
	notInArray,
	or,
	sql,
	type SQL
} from 'drizzle-orm';

import { db } from '$lib/server/db';
import {
	branch,
	patient,
	procedures,
	provider,
	services,
	treatmentPlan,
	treatmentPlanAdjustment,
	treatmentPlanItem,
	user
} from '$lib/server/db/schema';
import {
	notDeleted,
	softDeleteTreatmentPlan,
	softDeleteTreatmentPlanItem
} from '$lib/server/softDelete';
import { WriteRefused, refuseUnless } from '$lib/server/childCrud';
import { checkedProvider } from '$lib/server/appointments';
import { auditChanges, recordAudit, type AuditRequest } from '$lib/server/audit';
import { insertReturningId } from '$lib/server/db/insert';
import { providerEmployee, providerName } from '$lib/server/appointments';
import { patientFullName } from '$lib/server/patients';
import { branchFilter, type BranchContext } from '$lib/server/branchScope';
import { daysBetween, jsonValue } from '$lib/server/db/dialect';
import { addClinicDays, clinicToday, isIsoDate } from '$lib/clinicTime';
import { whereLabel } from '$lib/teeth';
import {
	DEFAULT_VALID_DAYS,
	canAddLines,
	canAdjust,
	canAnswer,
	canComplete,
	canEditLines,
	effectiveStatus,
	outcomeOf,
	type LineDecision,
	type PlanStatus
} from '$lib/treatmentPlanStatus';

/** A transaction on the database, as `db.transaction` hands it over. */
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** The database, or a transaction on it — a write re-reads inside its own transaction. */
type Reader = typeof db | Tx;

/* ── What is open ───────────────────────────────────────────────────────────────────────────── */

/**
 * The plans that still hold their work, as a condition on `treatment_plan`: drafts, answered yes
 * and unfinished, and presented while the quote still stands. The SQL twin of `isOpen` over
 * `effectiveStatus` — expiry is derived, so it is derived here too.
 */
export function openPlan(today: string): SQL | undefined {
	return or(
		inArray(treatmentPlan.status, ['draft', 'accepted', 'partial']),
		and(
			eq(treatmentPlan.status, 'presented'),
			or(isNull(treatmentPlan.validUntil), gte(treatmentPlan.validUntil, today))
		)
	);
}

/**
 * Each plan's line count and totals, as a subquery joined on `planId`. Grouped here, by the plan
 * alone, so the queries that join it need no `GROUP BY` of their own — MariaDB does not recognise
 * that a plan's dentist is fixed by the plan, and would refuse the names beside a grouped plan.
 * The aliases are prefixed so they cannot collide with a column of a table joined beside them.
 */
function planTotals() {
	const sumOf = (decision?: LineDecision) =>
		sql<number>`COALESCE(SUM(${
			decision
				? sql`CASE WHEN ${treatmentPlanItem.decision} = ${decision} THEN ${treatmentPlanItem.lineTotal} ELSE 0 END`
				: treatmentPlanItem.lineTotal
		}), 0)`;
	return db
		.select({
			planId: treatmentPlanItem.treatmentPlanId,
			lines: sql<number>`COUNT(*)`.as('plan_line_count'),
			quoted: sumOf().as('plan_quoted'),
			accepted: sumOf('accepted').as('plan_accepted')
		})
		.from(treatmentPlanItem)
		.where(notDeleted(treatmentPlanItem))
		.groupBy(treatmentPlanItem.treatmentPlanId)
		.as('plan_totals');
}

/* ── Reading ────────────────────────────────────────────────────────────────────────────────── */

/**
 * The patient's planned work not already spoken for by an open plan — what a new plan, or a draft's
 * "add work", may quote. With the price a line would be quoted at: the procedure's own fee, else the
 * service's list price.
 */
export async function plannableProcedures(patientId: number, reader: Reader = db) {
	const today = clinicToday();
	// Not-null filtered: `NOT IN` a list holding a NULL is never true, so one line without a
	// procedure would have hidden every piece of planned work.
	const onOpenPlan = reader
		.select({ id: sql<number>`${treatmentPlanItem.procedureId}` })
		.from(treatmentPlanItem)
		.innerJoin(
			treatmentPlan,
			and(eq(treatmentPlan.id, treatmentPlanItem.treatmentPlanId), notDeleted(treatmentPlan))
		)
		.where(
			and(
				eq(treatmentPlan.patientId, patientId),
				isNotNull(treatmentPlanItem.procedureId),
				notDeleted(treatmentPlanItem),
				openPlan(today)
			)
		);

	const rows = await reader
		.select({
			id: procedures.id,
			service: services.name,
			area: services.area,
			toothId: procedures.toothId,
			surfaces: procedures.surfaces,
			toothRange: procedures.toothRange,
			fee: procedures.fee,
			listPrice: services.price
		})
		.from(procedures)
		.leftJoin(services, eq(services.id, procedures.serviceId))
		.where(
			and(
				eq(procedures.patientId, patientId),
				eq(procedures.status, 'planned'),
				notDeleted(procedures),
				notInArray(procedures.id, onOpenPlan)
			)
		)
		.orderBy(asc(procedures.toothId), asc(procedures.id));

	return rows.map((row) => ({
		...row,
		where: whereLabel(row),
		price: row.fee ?? row.listPrice ?? 0
	}));
}

/** One row of `plannableProcedures`. */
export type PlannableProcedure = Awaited<ReturnType<typeof plannableProcedures>>[number];

/** The patient's plans, newest first, with their totals and the status to show. */
export async function patientPlans(patientId: number) {
	const today = clinicToday();
	const totals = planTotals();
	const rows = await db
		.select({
			id: treatmentPlan.id,
			status: treatmentPlan.status,
			validUntil: treatmentPlan.validUntil,
			presentedOn: treatmentPlan.presentedOn,
			decidedOn: treatmentPlan.decidedOn,
			createdAt: treatmentPlan.createdAt,
			providerId: treatmentPlan.providerId,
			provider: providerName,
			lines: totals.lines,
			quoted: totals.quoted,
			accepted: totals.accepted
		})
		.from(treatmentPlan)
		.leftJoin(totals, eq(totals.planId, treatmentPlan.id))
		.leftJoin(provider, eq(provider.id, treatmentPlan.providerId))
		.leftJoin(providerEmployee, eq(providerEmployee.id, provider.employeeId))
		.where(and(eq(treatmentPlan.patientId, patientId), notDeleted(treatmentPlan)))
		.orderBy(desc(treatmentPlan.createdAt), desc(treatmentPlan.id));

	return rows.map((row) => ({
		...row,
		lines: Number(row.lines ?? 0),
		quoted: Number(row.quoted ?? 0),
		accepted: Number(row.accepted ?? 0),
		status: effectiveStatus(row.status, row.validUntil, today)
	}));
}

/**
 * One plan of this patient's, with its lines — or null when there is no such plan for this
 * patient, which the page turns into a 404 rather than showing somebody else's quote.
 *
 * Each line carries its procedure's *current* status, for one purpose only: telling whether the
 * accepted work has been done. Its description and price are the line's own snapshot.
 */
export async function planDetail(patientId: number, planId: number) {
	const today = clinicToday();
	const [plan] = await db
		.select({
			id: treatmentPlan.id,
			patientId: treatmentPlan.patientId,
			status: treatmentPlan.status,
			presentedOn: treatmentPlan.presentedOn,
			decidedOn: treatmentPlan.decidedOn,
			validUntil: treatmentPlan.validUntil,
			declineReason: treatmentPlan.declineReason,
			note: treatmentPlan.note,
			createdAt: treatmentPlan.createdAt,
			providerId: treatmentPlan.providerId,
			provider: providerName,
			// Where it was drawn up: the letterhead of the printed quote.
			branch: branch.name,
			branchAddress: branch.address,
			branchPhone: branch.phone
		})
		.from(treatmentPlan)
		.leftJoin(provider, eq(provider.id, treatmentPlan.providerId))
		.leftJoin(providerEmployee, eq(providerEmployee.id, provider.employeeId))
		.leftJoin(branch, eq(branch.id, treatmentPlan.branchId))
		.where(
			and(
				eq(treatmentPlan.id, planId),
				eq(treatmentPlan.patientId, patientId),
				notDeleted(treatmentPlan)
			)
		)
		.limit(1);
	if (!plan) return null;

	const lines = await db
		.select({
			id: treatmentPlanItem.id,
			procedureId: treatmentPlanItem.procedureId,
			description: treatmentPlanItem.description,
			toothId: treatmentPlanItem.toothId,
			quantity: treatmentPlanItem.quantity,
			unitPrice: treatmentPlanItem.unitPrice,
			lineTotal: treatmentPlanItem.lineTotal,
			decision: treatmentPlanItem.decision,
			procedureStatus: procedures.status
		})
		.from(treatmentPlanItem)
		.leftJoin(
			procedures,
			and(eq(procedures.id, treatmentPlanItem.procedureId), notDeleted(procedures))
		)
		.where(and(eq(treatmentPlanItem.treatmentPlanId, planId), notDeleted(treatmentPlanItem)))
		.orderBy(asc(treatmentPlanItem.sortOrder), asc(treatmentPlanItem.id));

	return {
		...plan,
		storedStatus: plan.status,
		status: effectiveStatus(plan.status, plan.validUntil, today),
		lines
	};
}

/** What `planDetail` returns for a plan that exists. */
export type PlanDetail = NonNullable<Awaited<ReturnType<typeof planDetail>>>;

/** How much of the accepted work is done: accepted lines linked to charted work, and done ones. */
export function acceptedProgress(lines: PlanDetail['lines']) {
	const accepted = lines.filter((l) => l.decision === 'accepted' && l.procedureId !== null);
	return {
		done: accepted.filter((l) => l.procedureStatus === 'completed').length,
		total: accepted.length
	};
}

/**
 * The follow-up list: every quote still awaiting an answer and still valid, the longest-waiting
 * first — the patients to ring. Scoped to the branch being worked at (`treatment_plan` is in
 * `BRANCH_SCOPED`): a plan belongs to where it was made.
 */
export async function awaitingAnswer(branch: Pick<BranchContext, 'active'>) {
	const today = clinicToday();
	const totals = planTotals();
	const rows = await db
		.select({
			id: treatmentPlan.id,
			patientId: treatmentPlan.patientId,
			patient: patientFullName,
			fileNo: patient.fileNo,
			phone: patient.phone,
			provider: providerName,
			presentedOn: treatmentPlan.presentedOn,
			validUntil: treatmentPlan.validUntil,
			waitingDays: daysBetween(sql`${today}`, treatmentPlan.presentedOn),
			quoted: totals.quoted,
			note: treatmentPlan.note
		})
		.from(treatmentPlan)
		.innerJoin(patient, and(eq(patient.id, treatmentPlan.patientId), notDeleted(patient)))
		.leftJoin(totals, eq(totals.planId, treatmentPlan.id))
		.leftJoin(provider, eq(provider.id, treatmentPlan.providerId))
		.leftJoin(providerEmployee, eq(providerEmployee.id, provider.employeeId))
		.where(
			and(
				eq(treatmentPlan.status, 'presented'),
				or(isNull(treatmentPlan.validUntil), gte(treatmentPlan.validUntil, today)),
				notDeleted(treatmentPlan),
				branchFilter(treatmentPlan.branchId, branch)
			)
		)
		.orderBy(asc(treatmentPlan.presentedOn), asc(treatmentPlan.id));

	return rows.map((row) => ({
		...row,
		waitingDays: Number(row.waitingDays ?? 0),
		quoted: Number(row.quoted ?? 0)
	}));
}

/**
 * Case acceptance over plans presented since `since`: what was quoted, what was agreed, and how
 * many plans each way. The share of quoted value agreed is the one number that says whether a
 * clinic is losing work to hesitancy — see `treatmentPlan`.
 *
 * Plans still awaiting an answer are counted separately rather than as declined: an unanswered
 * quote is not a no, and counting it as one would make a busy week look like a bad one.
 */
export async function acceptanceSince(since: string, branch: Pick<BranchContext, 'active'>) {
	const totals = planTotals();
	const found = await db
		.select({
			status: treatmentPlan.status,
			validUntil: treatmentPlan.validUntil,
			quoted: totals.quoted,
			accepted: totals.accepted
		})
		.from(treatmentPlan)
		.leftJoin(totals, eq(totals.planId, treatmentPlan.id))
		.where(
			and(
				gte(treatmentPlan.presentedOn, since),
				notDeleted(treatmentPlan),
				branchFilter(treatmentPlan.branchId, branch)
			)
		);
	const rows = found.map((r) => ({
		...r,
		quoted: Number(r.quoted ?? 0),
		accepted: Number(r.accepted ?? 0)
	}));

	const today = clinicToday();
	const answered = rows.filter((r) =>
		['accepted', 'partial', 'declined', 'completed'].includes(r.status)
	);
	const quoted = answered.reduce((sum, r) => sum + r.quoted, 0);
	const accepted = answered.reduce((sum, r) => sum + r.accepted, 0);
	return {
		answered: answered.length,
		waiting: rows.filter((r) => effectiveStatus(r.status, r.validUntil, today) === 'presented')
			.length,
		expired: rows.filter((r) => effectiveStatus(r.status, r.validUntil, today) === 'expired')
			.length,
		quoted: Math.round(quoted * 100) / 100,
		accepted: Math.round(accepted * 100) / 100,
		rate: quoted > 0 ? Math.round((accepted / quoted) * 1000) / 10 : null
	};
}

/* ── Writing ────────────────────────────────────────────────────────────────────────────────── */

/** The plan a write is about, re-read inside the write's transaction and checked to be the patient's. */
async function planFor(tx: Tx, patientId: number, planId: number) {
	const [row] = await tx
		.select()
		.from(treatmentPlan)
		.where(
			and(
				eq(treatmentPlan.id, planId),
				eq(treatmentPlan.patientId, patientId),
				notDeleted(treatmentPlan)
			)
		)
		.limit(1);
	if (!row) throw new WriteRefused(null, 'That plan is not on this patient’s record.');
	return { ...row, status: effectiveStatus(row.status, row.validUntil, clinicToday()) };
}

/**
 * Writes quote lines for these procedures onto a plan, snapshotting what each is and costs. Every
 * id must be one of `plannableProcedures` — this patient's, planned, and on no open plan — or the
 * whole write is refused, since a stale dialog is the usual reason and half a plan is worse.
 */
async function writeLines(
	tx: Tx,
	event: AuditRequest,
	patientId: number,
	planId: number,
	procedureIds: number[]
): Promise<{ id: number; lineTotal: number }[]> {
	const wanted = [...new Set(procedureIds)];
	if (!wanted.length) throw new WriteRefused('procedureIds', 'Choose at least one piece of work.');

	const offered = await plannableProcedures(patientId, tx);
	const chosen = offered.filter((p) => wanted.includes(p.id));
	if (chosen.length !== wanted.length) {
		throw new WriteRefused(
			'procedureIds',
			'Some of that work is no longer planned, or is already on another plan. Reload and choose again.'
		);
	}

	const [{ last }] = await tx
		.select({ last: sql<number>`COALESCE(MAX(${treatmentPlanItem.sortOrder}), 0)`.mapWith(Number) })
		.from(treatmentPlanItem)
		.where(eq(treatmentPlanItem.treatmentPlanId, planId));

	const written: { id: number; lineTotal: number }[] = [];
	for (const [index, work] of chosen.entries()) {
		const description =
			work.area === 'mouth' || work.where === 'Whole mouth'
				? (work.service ?? 'Treatment')
				: `${work.service ?? 'Treatment'} — ${work.where}`;
		const id = await insertReturningId(tx, treatmentPlanItem, {
			treatmentPlanId: planId,
			procedureId: work.id,
			description: description.slice(0, 255),
			toothId: work.toothId,
			quantity: 1,
			unitPrice: work.price,
			lineTotal: work.price,
			sortOrder: last + index + 1,
			createdBy: event.locals.user?.id
		});
		await recordAudit(tx, event, { table: 'treatment_plan_item', recordId: id, action: 'create' });
		written.push({ id, lineTotal: work.price });
	}
	return written;
}

/** Starts a draft plan from planned work. Returns the new plan's id. */
export async function createPlan(
	tx: Tx,
	event: AuditRequest,
	input: {
		patientId: number;
		procedureIds: number[];
		providerId: number | null;
		note: string | null;
		branchId: number | null;
	}
): Promise<number> {
	const planId = await insertReturningId(tx, treatmentPlan, {
		patientId: input.patientId,
		providerId: await checkedProvider(tx, input.providerId),
		// Stamped from the branch being worked at, never defaulted (CLAUDE.md §15).
		branchId: input.branchId ?? undefined,
		status: 'draft',
		note: input.note,
		createdBy: event.locals.user?.id
	});
	await recordAudit(tx, event, { table: 'treatment_plan', recordId: planId, action: 'create' });
	await writeLines(tx, event, input.patientId, planId, input.procedureIds);
	return planId;
}

/* ── Adjusting a presented quote ─────────────────────────────────────────────────────────── */

/**
 * Why a change to a presented quote was made — required, since a price that moves without one is
 * exactly what the adjustment ledger exists to stop. Nothing is asked of a draft.
 */
function adjustmentReason(status: PlanStatus, reason: string | null | undefined): string | null {
	if (canEditLines(status)) return null;
	refuseUnless(canAdjust(status), 'This quote is closed; make a new plan instead.');
	const why = reason?.trim();
	if (!why) {
		throw new WriteRefused(
			'reason',
			'Say why the quote is changing — the patient was told something else.'
		);
	}
	return why.slice(0, 255);
}

/**
 * Writes one row of the quote's history (`treatment_plan_adjustment`). Only for a presented plan:
 * a draft's changes have no before, because nobody saw it.
 */
async function recordAdjustment(
	tx: Tx,
	event: AuditRequest,
	plan: { id: number; decidedOn: string | null },
	entry: {
		itemId: number;
		kind: 'changed' | 'added' | 'removed';
		changes?: Record<string, unknown> | null;
		lineTotalBefore: number;
		lineTotalAfter: number;
		reason: string;
	}
) {
	await tx.insert(treatmentPlanAdjustment).values({
		treatmentPlanId: plan.id,
		treatmentPlanItemId: entry.itemId,
		kind: entry.kind,
		changes: entry.changes ?? null,
		lineTotalBefore: entry.lineTotalBefore,
		lineTotalAfter: entry.lineTotalAfter,
		reason: entry.reason,
		afterAnswer: plan.decidedOn !== null,
		createdBy: event.locals.user?.id,
		createdAt: new Date()
	});
}

/**
 * Adds planned work to a plan — freely to a draft, and as a recorded adjustment to a presented
 * quote the patient has not answered yet. After an answer, new work goes on a new plan: a line
 * added then would have no answer of its own.
 */
export async function addLines(
	tx: Tx,
	event: AuditRequest,
	patientId: number,
	planId: number,
	procedureIds: number[],
	reason?: string | null
) {
	const plan = await planFor(tx, patientId, planId);
	refuseUnless(
		canAddLines(plan.status),
		plan.status === 'accepted' || plan.status === 'partial'
			? 'The patient has already answered this plan. Put new work on a new plan.'
			: 'Work can no longer be added to this plan.'
	);
	const why = adjustmentReason(plan.status, reason);
	const added = await writeLines(tx, event, patientId, planId, procedureIds);
	if (why === null) return;
	for (const line of added) {
		await recordAdjustment(tx, event, plan, {
			itemId: line.id,
			kind: 'added',
			lineTotalBefore: 0,
			lineTotalAfter: line.lineTotal,
			reason: why
		});
	}
}

/** The line, checked to be on this plan. */
async function lineFor(tx: Tx, planId: number, itemId: number) {
	const [line] = await tx
		.select()
		.from(treatmentPlanItem)
		.where(
			and(
				eq(treatmentPlanItem.id, itemId),
				eq(treatmentPlanItem.treatmentPlanId, planId),
				notDeleted(treatmentPlanItem)
			)
		)
		.limit(1);
	if (!line) throw new WriteRefused(null, 'That line is not on this plan.');
	return line;
}

/**
 * Changes a line's wording, quantity or price — freely on a draft; on a presented quote as an
 * adjustment, with its reason, kept for good. The total is worked out here, never taken from the
 * form. The patient's answer to the line stands; a change after they answered is flagged in the
 * history, because agreed work that changes price should be agreed again.
 */
export async function updateLine(
	tx: Tx,
	event: AuditRequest,
	patientId: number,
	planId: number,
	change: {
		itemId: number;
		description: string;
		quantity: number;
		unitPrice: number;
		reason?: string | null;
	}
) {
	const plan = await planFor(tx, patientId, planId);
	const why = adjustmentReason(plan.status, change.reason);
	const line = await lineFor(tx, planId, change.itemId);

	const written = {
		description: change.description.trim().slice(0, 255),
		quantity: change.quantity,
		unitPrice: change.unitPrice,
		lineTotal: Math.round(change.quantity * change.unitPrice * 100) / 100,
		updatedBy: event.locals.user?.id
	};
	// The fields that moved, bookkeeping aside — the same delta the audit row records.
	const moved = auditChanges(line, written);
	if (!Object.keys(moved).length) throw new WriteRefused(null, 'Nothing was changed.');

	await tx.update(treatmentPlanItem).set(written).where(eq(treatmentPlanItem.id, line.id));
	await recordAudit(tx, event, {
		table: 'treatment_plan_item',
		recordId: line.id,
		action: 'update',
		before: line,
		after: written
	});
	if (why !== null) {
		await recordAdjustment(tx, event, plan, {
			itemId: line.id,
			kind: 'changed',
			changes: moved,
			lineTotalBefore: line.lineTotal,
			lineTotalAfter: written.lineTotal,
			reason: why
		});
	}
}

/**
 * Takes a line off a plan. The work stays planned on the chart. On a presented quote the line is
 * kept, soft-deleted, and its removal recorded with the reason; on an answered one the plan's
 * status is worked out again from the lines left, so the plan and its lines still agree. The last
 * line cannot go — a quote of nothing is a plan to decline or leave to expire.
 */
export async function removeLine(
	tx: Tx,
	event: AuditRequest,
	patientId: number,
	planId: number,
	itemId: number,
	reason?: string | null
) {
	const plan = await planFor(tx, patientId, planId);
	const why = adjustmentReason(plan.status, reason);
	const line = await lineFor(tx, planId, itemId);

	const remaining = await tx
		.select({ id: treatmentPlanItem.id, decision: treatmentPlanItem.decision })
		.from(treatmentPlanItem)
		.where(
			and(
				eq(treatmentPlanItem.treatmentPlanId, planId),
				notDeleted(treatmentPlanItem),
				sql`${treatmentPlanItem.id} <> ${line.id}`
			)
		);
	if (why !== null && remaining.length === 0) {
		throw new WriteRefused(
			null,
			'This is the last line. Record the patient declining instead, or let the quote expire.'
		);
	}

	await softDeleteTreatmentPlanItem(tx, line.id, event.locals.user?.id);
	await recordAudit(tx, event, {
		table: 'treatment_plan_item',
		recordId: line.id,
		action: 'delete'
	});
	if (why === null) return;

	await recordAdjustment(tx, event, plan, {
		itemId: line.id,
		kind: 'removed',
		// Nothing to list: the row names the line, and its total either side is the whole change.
		changes: null,
		lineTotalBefore: line.lineTotal,
		lineTotalAfter: 0,
		reason: why
	});

	// An answered plan follows its lines: taking off the only "no" makes a partial plan accepted.
	if (plan.status === 'accepted' || plan.status === 'partial') {
		const outcome = outcomeOf(remaining.map((r) => r.decision));
		if (outcome !== null && outcome !== plan.status) {
			const written = { status: outcome, updatedBy: event.locals.user?.id };
			await tx.update(treatmentPlan).set(written).where(eq(treatmentPlan.id, planId));
			await recordAudit(tx, event, {
				table: 'treatment_plan',
				recordId: planId,
				action: 'update',
				before: plan,
				after: written
			});
		}
	}
}

/**
 * The quote's history, oldest first, with who made each change — what the plan page lists under
 * the lines, and what the printed quote's "revised" note is worked out from.
 */
export async function planAdjustments(planId: number, reader: Reader = db) {
	const rows = await reader
		.select({
			id: treatmentPlanAdjustment.id,
			itemId: treatmentPlanAdjustment.treatmentPlanItemId,
			line: treatmentPlanItem.description,
			kind: treatmentPlanAdjustment.kind,
			changes: treatmentPlanAdjustment.changes,
			lineTotalBefore: treatmentPlanAdjustment.lineTotalBefore,
			lineTotalAfter: treatmentPlanAdjustment.lineTotalAfter,
			reason: treatmentPlanAdjustment.reason,
			afterAnswer: treatmentPlanAdjustment.afterAnswer,
			createdAt: treatmentPlanAdjustment.createdAt,
			// Attribution is not filtered on deletion: a deleted user still made the change (§9).
			by: user.name
		})
		.from(treatmentPlanAdjustment)
		// Not `notDeleted`: a removed line is soft-deleted, and its removal must still name it.
		.innerJoin(
			treatmentPlanItem,
			eq(treatmentPlanItem.id, treatmentPlanAdjustment.treatmentPlanItemId)
		)
		.leftJoin(user, eq(user.id, treatmentPlanAdjustment.createdBy))
		.where(eq(treatmentPlanAdjustment.treatmentPlanId, planId))
		.orderBy(asc(treatmentPlanAdjustment.id));

	return rows.map((row) => {
		const changes = jsonValue(row.changes);
		return { ...row, changes: isChanges(changes) ? changes : {} };
	});
}

/** `changes` as stored — `{ field: [before, after] }` — checked rather than asserted (§3). */
function isChanges(value: unknown): value is Record<string, [unknown, unknown]> {
	return (
		typeof value === 'object' &&
		value !== null &&
		Object.values(value).every((pair) => Array.isArray(pair) && pair.length === 2)
	);
}

/** One row of `planAdjustments`. */
export type PlanAdjustment = Awaited<ReturnType<typeof planAdjustments>>[number];

/**
 * What the quote came to when it was presented: today's total less every adjustment's effect.
 * Each row carries the line total either side of it, so this needs no replay.
 */
export function originalTotal(current: number, adjustments: PlanAdjustment[]): number {
	const moved = adjustments.reduce((sum, a) => sum + (a.lineTotalAfter - a.lineTotalBefore), 0);
	return Math.round((current - moved) * 100) / 100;
}

/** Discards a draft plan. A presented plan is kept whatever happened to it. */
export async function discardDraft(tx: Tx, event: AuditRequest, patientId: number, planId: number) {
	const plan = await planFor(tx, patientId, planId);
	refuseUnless(plan.status === 'draft', 'Only a draft can be discarded; a presented plan is kept.');
	await softDeleteTreatmentPlan(tx, planId, event.locals.user?.id);
	await recordAudit(tx, event, { table: 'treatment_plan', recordId: planId, action: 'delete' });
}

/**
 * Marks a draft as shown to the patient, from today, standing until `validUntil` — by default
 * `DEFAULT_VALID_DAYS` from now. From here a change to the lines is an adjustment, kept for good.
 */
export async function presentPlan(
	tx: Tx,
	event: AuditRequest,
	patientId: number,
	planId: number,
	validUntil: string | null
) {
	const plan = await planFor(tx, patientId, planId);
	refuseUnless(plan.status === 'draft', 'This plan has already been presented.');

	const today = clinicToday();
	const until = validUntil || addClinicDays(today, DEFAULT_VALID_DAYS);
	if (!isIsoDate(until) || until < today) {
		throw new WriteRefused('validUntil', 'Choose a date from today on.');
	}

	const [{ lines }] = await tx
		.select({ lines: sql<number>`COUNT(*)`.mapWith(Number) })
		.from(treatmentPlanItem)
		.where(and(eq(treatmentPlanItem.treatmentPlanId, planId), notDeleted(treatmentPlanItem)));
	refuseUnless(lines > 0, 'A plan needs at least one line before it is presented.');

	const written = {
		status: 'presented' as const,
		presentedOn: today,
		validUntil: until,
		updatedBy: event.locals.user?.id
	};
	await tx.update(treatmentPlan).set(written).where(eq(treatmentPlan.id, planId));
	await recordAudit(tx, event, {
		table: 'treatment_plan',
		recordId: planId,
		action: 'update',
		before: plan,
		after: written
	});
}

/**
 * Records the patient's answer: a decision on every line, and a reason whenever any of it was a
 * no. The plan's status follows from the lines (`outcomeOf`), so the two cannot disagree.
 */
export async function answerPlan(
	tx: Tx,
	event: AuditRequest,
	patientId: number,
	planId: number,
	answer: { decisions: Record<number, 'accepted' | 'declined'>; reason: string | null }
) {
	const plan = await planFor(tx, patientId, planId);
	if (plan.status === 'expired') {
		throw new WriteRefused(
			null,
			'This quote has expired. Make a new plan so the prices are today’s.'
		);
	}
	refuseUnless(canAnswer(plan.status), 'This plan has already been answered.');

	const lines = await tx
		.select()
		.from(treatmentPlanItem)
		.where(and(eq(treatmentPlanItem.treatmentPlanId, planId), notDeleted(treatmentPlanItem)));

	const decided = lines.map((line) => answer.decisions[line.id] ?? 'pending');
	const unknown = Object.keys(answer.decisions).filter(
		(id) => !lines.some((line) => line.id === Number(id))
	);
	if (unknown.length) throw new WriteRefused(null, 'That answer names a line not on this plan.');

	const outcome = outcomeOf(decided);
	if (outcome === null) throw new WriteRefused(null, 'Record yes or no for every line.');

	const reason = answer.reason?.trim() || null;
	if (outcome !== 'accepted' && !reason) {
		throw new WriteRefused(
			'declineReason',
			'Say why — “after the harvest”, “second opinion” and “cannot afford it” need different follow-ups.'
		);
	}

	for (const [index, line] of lines.entries()) {
		const decision = decided[index];
		await tx
			.update(treatmentPlanItem)
			.set({ decision, updatedBy: event.locals.user?.id })
			.where(eq(treatmentPlanItem.id, line.id));
	}

	const written = {
		status: outcome,
		decidedOn: clinicToday(),
		declineReason: outcome === 'accepted' ? null : reason,
		updatedBy: event.locals.user?.id
	};
	await tx.update(treatmentPlan).set(written).where(eq(treatmentPlan.id, planId));
	// One audit row for the answer, naming each line's decision — not one per line (§11: an
	// operation over many rows is logged as the operation).
	await recordAudit(tx, event, {
		table: 'treatment_plan',
		recordId: planId,
		action: 'update',
		before: plan,
		after: written,
		detail: {
			decisions: Object.fromEntries(lines.map((line, index) => [line.id, decided[index]]))
		}
	});
}

/** Closes a plan whose accepted work is all done. */
export async function completePlan(tx: Tx, event: AuditRequest, patientId: number, planId: number) {
	const plan = await planFor(tx, patientId, planId);
	const rows = await tx
		.select({ status: procedures.status })
		.from(treatmentPlanItem)
		.innerJoin(procedures, eq(procedures.id, treatmentPlanItem.procedureId))
		.where(
			and(
				eq(treatmentPlanItem.treatmentPlanId, planId),
				eq(treatmentPlanItem.decision, 'accepted'),
				notDeleted(treatmentPlanItem),
				notDeleted(procedures)
			)
		);
	const done = rows.filter((r) => r.status === 'completed').length;
	refuseUnless(
		canComplete(plan.status, done, rows.length),
		'Not all the accepted work is done yet — mark it completed on the dental chart first.'
	);

	const written = { status: 'completed' as const, updatedBy: event.locals.user?.id };
	await tx.update(treatmentPlan).set(written).where(eq(treatmentPlan.id, planId));
	await recordAudit(tx, event, {
		table: 'treatment_plan',
		recordId: planId,
		action: 'update',
		before: plan,
		after: written
	});
}

/** The statuses, re-exported for the pages that only need the type. */
export type { PlanStatus };
