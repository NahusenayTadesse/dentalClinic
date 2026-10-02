/**
 * The sterilisation log: recording a cycle and labelling its packs, reading a spore test, and
 * recording which pack was opened for which patient. The rules are `$lib/sterilisation.ts`'s; this
 * module stores them and enforces them on every write, because the form is a courtesy (§9).
 *
 *   - a cycle belongs to the branch its steriliser stands in, and is numbered on from that
 *     steriliser's last — locked, so two people recording at once cannot take one number
 *   - packs are labelled only from a load whose chemical indicator did not fail
 *   - a pack is opened once, for one patient, and never from a failed cycle or past its date
 *   - a spore test is read once; reading a failure fails the cycle after the fact, and the cycle's
 *     page then lists the patients its packs were used on
 *
 * Audit (§11): a cycle's creation and its spore-test reading are each a row; a pack's use is a row
 * on `pack_use`. The packs themselves are not audited — they never change.
 *
 * Non-goals: deleting a cycle (a log with holes is not a log; a mistake is noted on the cycle), and
 * moving a steriliser between branches with its history.
 */
import { and, count, desc, eq, inArray, max } from 'drizzle-orm';

import { db } from '$lib/server/db';
import {
	appointment,
	instrumentPack,
	packUse,
	patient,
	steriliser,
	sterilisationCycle
} from '$lib/server/db/schema';
import { insertReturningId } from '@nahu/admin-kit/server/db/insert.js';
import { notDeleted } from '$lib/server/softDelete';
import { recordAudit, type AuditRequest } from '$lib/server/audit';
import { WriteRefused, refuseUnless } from '$lib/server/childCrud';
import { branchFilter, type BranchContext } from '$lib/server/branchScope';
import { patientFullName } from '$lib/server/patients';
import { addClinicDays, clinicDate, clinicToday } from '$lib/clinicTime';
import {
	PACK_STATE_LABEL,
	cycleStatus,
	packCode,
	packState,
	type CycleKind,
	type IndicatorResult
} from '$lib/sterilisation';

/** A transaction on the database, as `db.transaction` hands it over. */
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Who records cycles and pack use. */
export const STERILISATION_PERMISSION = 'sterilisation.record';

type Scope = Pick<BranchContext, 'active'>;

/** The sterilisers at the branch being worked at, for the form. */
export function sterilisersAt(scope: Scope) {
	return db
		.select({ value: steriliser.id, name: steriliser.name })
		.from(steriliser)
		.where(
			and(
				eq(steriliser.isActive, true),
				notDeleted(steriliser),
				branchFilter(steriliser.branchId, scope)
			)
		)
		.orderBy(steriliser.name);
}

/** The log: the latest cycles at the branch, each with how many packs it made and how many are used. */
export async function cycleLog(scope: Scope, limit = 300) {
	const cycles = await db
		.select({
			id: sterilisationCycle.id,
			steriliser: steriliser.name,
			cycleNo: sterilisationCycle.cycleNo,
			kind: sterilisationCycle.kind,
			ranAt: sterilisationCycle.ranAt,
			program: sterilisationCycle.program,
			chemical: sterilisationCycle.chemicalIndicator,
			biological: sterilisationCycle.biologicalIndicator,
			status: sterilisationCycle.status
		})
		.from(sterilisationCycle)
		.innerJoin(steriliser, eq(steriliser.id, sterilisationCycle.steriliserId))
		.where(and(notDeleted(sterilisationCycle), branchFilter(sterilisationCycle.branchId, scope)))
		.orderBy(desc(sterilisationCycle.ranAt), desc(sterilisationCycle.id))
		.limit(limit);
	if (!cycles.length) return [];

	const counts = await db
		.select({ cycleId: instrumentPack.cycleId, packs: count(), used: count(packUse.id) })
		.from(instrumentPack)
		.leftJoin(packUse, and(eq(packUse.packId, instrumentPack.id), notDeleted(packUse)))
		.where(
			inArray(
				instrumentPack.cycleId,
				cycles.map((c) => c.id)
			)
		)
		.groupBy(instrumentPack.cycleId);
	const byCycle = new Map(counts.map((c) => [c.cycleId, c]));
	return cycles.map((c) => ({
		...c,
		packs: byCycle.get(c.id)?.packs ?? 0,
		used: byCycle.get(c.id)?.used ?? 0
	}));
}

/** One row of `cycleLog`. */
export type CycleLogRow = Awaited<ReturnType<typeof cycleLog>>[number];

/** What recording a cycle needs. `packs` is what the load held, by label. */
export type CycleInput = {
	steriliserId: number;
	kind: CycleKind;
	ranAt: Date;
	program: string | null;
	temperatureC: number | null;
	holdMinutes: number | null;
	chemical: IndicatorResult;
	biological: IndicatorResult;
	note: string | null;
	packs: { contents: string; count: number }[];
	shelfDays: number;
};

/** Records a cycle and labels its packs. Returns the cycle's id. */
export async function recordCycle(
	tx: Tx,
	event: AuditRequest & { locals: { branch: Scope } },
	input: CycleInput
): Promise<number> {
	const [machine] = await tx
		.select({ id: steriliser.id, branchId: steriliser.branchId })
		.from(steriliser)
		.where(
			and(
				eq(steriliser.id, input.steriliserId),
				eq(steriliser.isActive, true),
				notDeleted(steriliser),
				branchFilter(steriliser.branchId, event.locals.branch)
			)
		)
		.limit(1)
		// Serialises numbering on this steriliser.
		.for('update');
	refuseUnless(Boolean(machine), 'Choose a steriliser at this branch.', 'steriliserId');
	refuseUnless(
		input.chemical !== 'pending',
		'A chemical indicator is read when the load comes out: pass, fail, or not used.',
		'chemical'
	);
	const packCount = input.packs.reduce((sum, p) => sum + p.count, 0);
	refuseUnless(
		input.kind === 'load' || packCount === 0,
		'A machine test sterilises nothing: it makes no packs.'
	);
	refuseUnless(
		input.chemical !== 'fail' || packCount === 0,
		'The load failed its indicator. Resterilise it rather than labelling its packs.'
	);
	refuseUnless(packCount <= 200, 'That is more packs than one load holds.');

	const [last] = await tx
		.select({ n: max(sterilisationCycle.cycleNo) })
		.from(sterilisationCycle)
		.where(eq(sterilisationCycle.steriliserId, machine.id));
	const cycleNo = (last?.n ?? 0) + 1;

	const id = await insertReturningId(tx, sterilisationCycle, {
		steriliserId: machine.id,
		branchId: machine.branchId ?? undefined,
		cycleNo,
		kind: input.kind,
		ranAt: input.ranAt,
		program: input.program,
		temperatureC: input.temperatureC,
		holdMinutes: input.holdMinutes,
		chemicalIndicator: input.chemical,
		biologicalIndicator: input.biological,
		status: cycleStatus(input.chemical, input.biological),
		note: input.note,
		createdBy: event.locals.user?.id
	});

	if (packCount) {
		const expiresOn = addClinicDays(clinicDate(input.ranAt), input.shelfDays);
		let n = 0;
		await tx.insert(instrumentPack).values(
			input.packs.flatMap((p) =>
				Array.from({ length: p.count }, () => ({
					cycleId: id,
					code: packCode(machine.id, cycleNo, ++n),
					contents: p.contents || null,
					expiresOn,
					createdBy: event.locals.user?.id
				}))
			)
		);
	}

	await recordAudit(tx, event, {
		table: 'sterilisation_cycle',
		recordId: id,
		action: 'create',
		detail: { packs: packCount }
	});
	return id;
}

/** The cycle, locked, if it is at this branch. */
async function cycleFor(tx: Tx, scope: Scope, cycleId: number) {
	const [row] = await tx
		.select({
			id: sterilisationCycle.id,
			chemical: sterilisationCycle.chemicalIndicator,
			biological: sterilisationCycle.biologicalIndicator,
			status: sterilisationCycle.status
		})
		.from(sterilisationCycle)
		.where(
			and(
				eq(sterilisationCycle.id, cycleId),
				notDeleted(sterilisationCycle),
				branchFilter(sterilisationCycle.branchId, scope)
			)
		)
		.limit(1)
		.for('update');
	refuseUnless(Boolean(row), 'That cycle is not in this branch’s log.');
	return row;
}

/** Reads a cycle's spore test. Once only: a reading is evidence, not a draft. */
export async function readSporeTest(
	tx: Tx,
	event: AuditRequest & { locals: { branch: Scope } },
	cycleId: number,
	result: 'pass' | 'fail'
) {
	const cycle = await cycleFor(tx, event.locals.branch, cycleId);
	refuseUnless(cycle.biological === 'pending', 'This cycle has no spore test waiting to be read.');
	const after = {
		biologicalIndicator: result,
		biologicalReadAt: new Date(),
		status: cycleStatus(cycle.chemical, result),
		updatedBy: event.locals.user?.id
	};
	await tx.update(sterilisationCycle).set(after).where(eq(sterilisationCycle.id, cycleId));
	await recordAudit(tx, event, {
		table: 'sterilisation_cycle',
		recordId: cycleId,
		action: 'update',
		before: { biologicalIndicator: cycle.biological, status: cycle.status },
		after: { biologicalIndicator: after.biologicalIndicator, status: after.status }
	});
}

/**
 * Records packs opened for a patient. Each code must be a pack that is ready (`packState`); the
 * first that is not is refused by name, and nothing is recorded. Returns how many were recorded.
 */
export async function usePacks(
	tx: Tx,
	event: AuditRequest,
	patientId: number,
	codes: string[],
	appointmentId: number | null
): Promise<number> {
	refuseUnless(codes.length > 0, 'Type or scan the code on each pack.', 'codes');
	const packs = await tx
		.select({
			id: instrumentPack.id,
			code: instrumentPack.code,
			expiresOn: instrumentPack.expiresOn,
			status: sterilisationCycle.status,
			usedAt: packUse.usedAt
		})
		.from(instrumentPack)
		.innerJoin(sterilisationCycle, eq(sterilisationCycle.id, instrumentPack.cycleId))
		.leftJoin(packUse, and(eq(packUse.packId, instrumentPack.id), notDeleted(packUse)))
		.where(and(inArray(instrumentPack.code, codes), notDeleted(instrumentPack)))
		.for('update');

	const today = clinicToday();
	for (const code of codes) {
		const pack = packs.find((p) => p.code === code);
		if (!pack) throw new WriteRefused('codes', `No pack has the code ${code}.`);
		const state = packState(pack, pack.status, today);
		refuseUnless(
			state === 'ready',
			`Pack ${code} cannot be used: ${PACK_STATE_LABEL[state].toLowerCase()}.`,
			'codes'
		);
	}

	if (appointmentId !== null) {
		const [visit] = await tx
			.select({ id: appointment.id })
			.from(appointment)
			.where(and(eq(appointment.id, appointmentId), eq(appointment.patientId, patientId)))
			.limit(1);
		refuseUnless(Boolean(visit), 'That visit is not this patient’s.', 'appointmentId');
	}

	const usedAt = new Date();
	for (const pack of packs) {
		const id = await insertReturningId(tx, packUse, {
			packId: pack.id,
			patientId,
			appointmentId,
			usedAt,
			createdBy: event.locals.user?.id
		});
		await recordAudit(tx, event, { table: 'pack_use', recordId: id, action: 'create' });
	}
	return packs.length;
}

/** One cycle with its packs and who each was used on, or null when it is not at this branch. */
export async function cycleDetail(scope: Scope, cycleId: number) {
	const [cycle] = await db
		.select({
			id: sterilisationCycle.id,
			steriliser: steriliser.name,
			steriliserId: steriliser.id,
			cycleNo: sterilisationCycle.cycleNo,
			kind: sterilisationCycle.kind,
			ranAt: sterilisationCycle.ranAt,
			program: sterilisationCycle.program,
			temperatureC: sterilisationCycle.temperatureC,
			holdMinutes: sterilisationCycle.holdMinutes,
			chemical: sterilisationCycle.chemicalIndicator,
			biological: sterilisationCycle.biologicalIndicator,
			biologicalReadAt: sterilisationCycle.biologicalReadAt,
			status: sterilisationCycle.status,
			note: sterilisationCycle.note
		})
		.from(sterilisationCycle)
		.innerJoin(steriliser, eq(steriliser.id, sterilisationCycle.steriliserId))
		.where(
			and(
				eq(sterilisationCycle.id, cycleId),
				notDeleted(sterilisationCycle),
				branchFilter(sterilisationCycle.branchId, scope)
			)
		)
		.limit(1);
	if (!cycle) return null;

	const packs = await db
		.select({
			id: instrumentPack.id,
			code: instrumentPack.code,
			contents: instrumentPack.contents,
			expiresOn: instrumentPack.expiresOn,
			usedAt: packUse.usedAt,
			patientId: packUse.patientId,
			patient: patientFullName,
			fileNo: patient.fileNo,
			phone: patient.phone
		})
		.from(instrumentPack)
		.leftJoin(packUse, and(eq(packUse.packId, instrumentPack.id), notDeleted(packUse)))
		.leftJoin(patient, eq(patient.id, packUse.patientId))
		.where(and(eq(instrumentPack.cycleId, cycleId), notDeleted(instrumentPack)))
		.orderBy(instrumentPack.code);

	const today = clinicToday();
	return {
		cycle,
		packs: packs.map((p) => ({ ...p, state: packState(p, cycle.status, today) }))
	};
}
