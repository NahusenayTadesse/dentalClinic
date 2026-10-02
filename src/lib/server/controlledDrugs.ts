/**
 * The controlled-medicine register and its monthly return, read from the stock ledger. The
 * arithmetic is `$lib/controlledDrugs.ts`'s; the rule on what a controlled movement must name is
 * enforced where stock moves (the supply page's actions).
 *
 * A medicine is controlled when its `medicine.controlClass` is set; a stock item is controlled when
 * it is linked to one. Each branch keeps its own stock, so its own register (§15).
 *
 * Periods are clinic days: a month runs from midnight at the clinic on its first day to midnight
 * after its last (`clinicDayRange`), so a dose given at 11 p.m. on the 30th is in that month.
 *
 * Non-goals: the authority's electronic submission (none is published for clinics), and the
 * prescription for a controlled medicine as its own numbered form — the issue names the patient,
 * and the prescription, when one was written, is on their chart.
 */
import { and, asc, eq, gte, isNotNull, lt, sql, sum } from 'drizzle-orm';
import { alias } from 'drizzle-orm/mysql-core';

import { db } from '$lib/server/db';
import {
	medicine,
	patient,
	supplies,
	suppliesAdjustments,
	supplyBatch,
	supplySuppliers,
	user
} from '$lib/server/db/schema';
import { notDeleted } from '$lib/server/softDelete';
import { branchFilter, type BranchContext } from '$lib/server/branchScope';
import { onHand } from '$lib/server/stock';
import { patientFullName } from '$lib/server/patients';
import { clinicDayRange, clinicToday } from '$lib/clinicTime';
import { monthReturn, withBalance } from '$lib/controlledDrugs';
import type { MonthPeriod } from '$lib/ethiopianMonth';

type Scope = Pick<BranchContext, 'active'>;

/** When a period starts and ends, as instants. */
function bounds(period: MonthPeriod) {
	return { from: clinicDayRange(period.start).start, to: clinicDayRange(period.end).end };
}

/** The controlled stock items at the branch, with what their lots hold now. */
export function controlledSupplies(scope: Scope) {
	return db
		.select({
			id: supplies.id,
			name: supplies.name,
			unit: supplies.unitOfMeasure,
			medicine: medicine.genericName,
			strength: medicine.strength,
			controlClass: medicine.controlClass,
			onHand: onHand()
		})
		.from(supplies)
		.innerJoin(medicine, eq(medicine.id, supplies.medicineId))
		.where(
			and(
				isNotNull(medicine.controlClass),
				notDeleted(supplies),
				branchFilter(supplies.branchId, scope)
			)
		)
		.orderBy(asc(medicine.genericName), asc(supplies.name));
}

/** One controlled item. */
export type ControlledSupply = Awaited<ReturnType<typeof controlledSupplies>>[number];

/** What the ledger says was there before `from`: every movement before it, added up. */
async function balanceBefore(supplyId: number, from: Date): Promise<number> {
	const [row] = await db
		.select({ total: sum(suppliesAdjustments.adjustment).mapWith(Number) })
		.from(suppliesAdjustments)
		.where(
			and(
				eq(suppliesAdjustments.suppliesId, supplyId),
				notDeleted(suppliesAdjustments),
				lt(suppliesAdjustments.createdAt, from)
			)
		);
	return row?.total ?? 0;
}

const recorder = alias(user, 'register_recorder');

/**
 * One item's register for a month: the opening balance, every movement with the balance after it,
 * and — for a month still running — whether the balance agrees with what the lots hold.
 */
export async function registerFor(item: ControlledSupply, period: MonthPeriod) {
	const { from, to } = bounds(period);
	const [opening, rows] = await Promise.all([
		balanceBefore(item.id, from),
		db
			.select({
				id: suppliesAdjustments.id,
				at: suppliesAdjustments.createdAt,
				movement: suppliesAdjustments.movementType,
				quantity: suppliesAdjustments.adjustment,
				batchNumber: supplyBatch.batchNumber,
				expiryDate: supplyBatch.expiryDate,
				supplier: supplySuppliers.name,
				patientId: patient.id,
				patient: patientFullName,
				fileNo: patient.fileNo,
				prescriptionId: suppliesAdjustments.prescriptionId,
				reason: suppliesAdjustments.reason,
				// Attribution: a deleted user still recorded what they recorded (CLAUDE.md §9).
				recordedBy: recorder.name
			})
			.from(suppliesAdjustments)
			.leftJoin(supplyBatch, eq(supplyBatch.id, suppliesAdjustments.batchId))
			.leftJoin(
				supplySuppliers,
				eq(
					supplySuppliers.id,
					sql`coalesce(${suppliesAdjustments.supplierId}, ${supplyBatch.supplierId})`
				)
			)
			.leftJoin(patient, eq(patient.id, suppliesAdjustments.patientId))
			.leftJoin(recorder, eq(recorder.id, suppliesAdjustments.createdBy))
			.where(
				and(
					eq(suppliesAdjustments.suppliesId, item.id),
					notDeleted(suppliesAdjustments),
					gte(suppliesAdjustments.createdAt, from),
					lt(suppliesAdjustments.createdAt, to)
				)
			)
			.orderBy(asc(suppliesAdjustments.createdAt), asc(suppliesAdjustments.id))
	]);

	const lines = withBalance(opening, rows);
	const summary = monthReturn(
		opening,
		rows.map((r) => ({ movement: r.movement, quantity: r.quantity }))
	);
	// Only a month still running can be checked against the shelf: the lots hold today's stock.
	const running = period.end >= clinicToday();
	return {
		lines,
		summary,
		shelf: running
			? { onHand: Number(item.onHand), agrees: Number(item.onHand) === summary.closing }
			: null
	};
}

/** The monthly return: every controlled item at the branch, added up for the month. */
export async function controlledReturn(scope: Scope, period: MonthPeriod) {
	const items = await controlledSupplies(scope);
	const { from, to } = bounds(period);
	const rows = await Promise.all(
		items.map(async (item) => {
			const [opening, moves] = await Promise.all([
				balanceBefore(item.id, from),
				db
					.select({
						movement: suppliesAdjustments.movementType,
						quantity: sum(suppliesAdjustments.adjustment).mapWith(Number)
					})
					.from(suppliesAdjustments)
					.where(
						and(
							eq(suppliesAdjustments.suppliesId, item.id),
							notDeleted(suppliesAdjustments),
							gte(suppliesAdjustments.createdAt, from),
							lt(suppliesAdjustments.createdAt, to)
						)
					)
					.groupBy(suppliesAdjustments.movementType)
			]);
			return {
				item,
				...monthReturn(
					opening,
					moves.map((m) => ({ movement: m.movement, quantity: m.quantity }))
				)
			};
		})
	);
	return rows;
}
