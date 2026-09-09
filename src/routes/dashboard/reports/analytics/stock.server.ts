import { count, countDistinct, desc, eq, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import {
	damagedSupplies,
	employee,
	supplies,
	suppliesAdjustments,
	supplySuppliers,
	supplyTypes
} from '$lib/server/db/schema';
import { notDeleted } from '$lib/server/softDelete';
import type { ReportFilters } from '../filters';
import type { ReportChartData, Stat } from '../types';
import {
	alignMonths,
	all,
	countWhen,
	inRange,
	monthKeys,
	monthOf,
	n,
	topN,
	total
} from '../scope.server';
import { employeeFullName } from '$lib/server/employeeName';

/**
 * What came into the store room and what went out.
 *
 * `suppliesAdjustments.adjustment` is signed — positive is stock arriving,
 * negative is stock being consumed — so both directions come out of one pass
 * over the ledger rather than two queries with opposite filters.
 */
export async function stockStats(
	filters: ReportFilters
): Promise<{ stats: Stat[]; charts: ReportChartData[] }> {
	const keys = monthKeys(filters);

	const movementWhere = all([
		notDeleted(suppliesAdjustments),
		inRange(suppliesAdjustments.createdAt, filters),
		filters.supplierId ? eq(suppliesAdjustments.supplierId, filters.supplierId) : undefined,
		filters.supplyTypeId ? eq(supplies.supplyTypeId, filters.supplyTypeId) : undefined,
		filters.staffId ? eq(suppliesAdjustments.employeeResponsible, filters.staffId) : undefined
	]);

	const damageWhere = all([
		notDeleted(damagedSupplies),
		inRange(damagedSupplies.createdAt, filters),
		filters.supplyTypeId ? eq(supplies.supplyTypeId, filters.supplyTypeId) : undefined,
		filters.staffId ? eq(damagedSupplies.damagedBy, filters.staffId) : undefined
	]);

	const stockWhere = all([
		notDeleted(supplies),
		filters.supplyTypeId ? eq(supplies.supplyTypeId, filters.supplyTypeId) : undefined
	]);

	const [
		[movements],
		[damage],
		[onHand],
		movementsByMonth,
		byType,
		bySupply,
		bySupplier,
		byHandler,
		damageBySupply,
		stockLevels,
		belowReorder
	] = await Promise.all([
		db
			.select({
				entries: count(),
				added: sql<string>`COALESCE(SUM(CASE WHEN ${suppliesAdjustments.adjustment} > 0 THEN ${suppliesAdjustments.adjustment} ELSE 0 END), 0)`,
				taken: sql<string>`COALESCE(SUM(CASE WHEN ${suppliesAdjustments.adjustment} < 0 THEN -${suppliesAdjustments.adjustment} ELSE 0 END), 0)`,
				purchaseCost: sql<string>`COALESCE(SUM(CASE WHEN ${suppliesAdjustments.adjustment} > 0 THEN ${suppliesAdjustments.total} ELSE 0 END), 0)`,
				consumedValue: sql<string>`COALESCE(SUM(CASE WHEN ${suppliesAdjustments.adjustment} < 0 THEN ${suppliesAdjustments.total} ELSE 0 END), 0)`,
				items: countDistinct(suppliesAdjustments.suppliesId)
			})
			.from(suppliesAdjustments)
			.leftJoin(supplies, eq(suppliesAdjustments.suppliesId, supplies.id))
			.where(movementWhere),

		db
			.select({
				reports: count(),
				quantity: total(damagedSupplies.quantity),
				deductable: countWhen(sql`${damagedSupplies.deductable} = true`)
			})
			.from(damagedSupplies)
			.leftJoin(supplies, eq(damagedSupplies.supplyId, supplies.id))
			.where(damageWhere),

		db
			.select({
				items: count(),
				quantity: total(supplies.quantity),
				belowReorder: countWhen(
					sql`${supplies.reorderLevel} IS NOT NULL AND ${supplies.quantity} <= ${supplies.reorderLevel}`
				),
				empty: countWhen(sql`${supplies.quantity} <= 0`)
			})
			.from(supplies)
			.where(stockWhere),

		db
			.select({
				bucket: monthOf(suppliesAdjustments.createdAt),
				added: sql<string>`COALESCE(SUM(CASE WHEN ${suppliesAdjustments.adjustment} > 0 THEN ${suppliesAdjustments.adjustment} ELSE 0 END), 0)`,
				taken: sql<string>`COALESCE(SUM(CASE WHEN ${suppliesAdjustments.adjustment} < 0 THEN -${suppliesAdjustments.adjustment} ELSE 0 END), 0)`,
				cost: sql<string>`COALESCE(SUM(CASE WHEN ${suppliesAdjustments.adjustment} > 0 THEN ${suppliesAdjustments.total} ELSE 0 END), 0)`
			})
			.from(suppliesAdjustments)
			.leftJoin(supplies, eq(suppliesAdjustments.suppliesId, supplies.id))
			.where(movementWhere)
			.groupBy(sql`1`),

		db
			.select({
				label: supplyTypes.name,
				value: sql<string>`COALESCE(SUM(ABS(${suppliesAdjustments.adjustment})), 0)`
			})
			.from(suppliesAdjustments)
			.leftJoin(supplies, eq(suppliesAdjustments.suppliesId, supplies.id))
			.leftJoin(supplyTypes, eq(supplies.supplyTypeId, supplyTypes.id))
			.where(movementWhere)
			.groupBy(supplyTypes.name),

		db
			.select({
				label: supplies.name,
				value: sql<string>`COALESCE(SUM(CASE WHEN ${suppliesAdjustments.adjustment} < 0 THEN -${suppliesAdjustments.adjustment} ELSE 0 END), 0)`
			})
			.from(suppliesAdjustments)
			.leftJoin(supplies, eq(suppliesAdjustments.suppliesId, supplies.id))
			.where(movementWhere)
			.groupBy(supplies.name)
			.orderBy(desc(sql`2`))
			.limit(12),

		db
			.select({
				label: supplySuppliers.name,
				value: sql<string>`COALESCE(SUM(CASE WHEN ${suppliesAdjustments.adjustment} > 0 THEN ${suppliesAdjustments.total} ELSE 0 END), 0)`
			})
			.from(suppliesAdjustments)
			.leftJoin(supplies, eq(suppliesAdjustments.suppliesId, supplies.id))
			.leftJoin(supplySuppliers, eq(suppliesAdjustments.supplierId, supplySuppliers.id))
			.where(movementWhere)
			.groupBy(supplySuppliers.name),

		db
			.select({
				label: employeeFullName,
				value: count()
			})
			.from(suppliesAdjustments)
			.leftJoin(supplies, eq(suppliesAdjustments.suppliesId, supplies.id))
			.leftJoin(employee, eq(suppliesAdjustments.employeeResponsible, employee.id))
			.where(movementWhere)
			.groupBy(sql`1`)
			.orderBy(desc(sql`2`))
			.limit(12),

		db
			.select({ label: supplies.name, value: total(damagedSupplies.quantity) })
			.from(damagedSupplies)
			.leftJoin(supplies, eq(damagedSupplies.supplyId, supplies.id))
			.where(damageWhere)
			.groupBy(supplies.name)
			.orderBy(desc(sql`2`))
			.limit(12),

		db
			.select({ label: supplies.name, value: sql<string>`${supplies.quantity}` })
			.from(supplies)
			.where(stockWhere)
			.orderBy(desc(supplies.quantity))
			.limit(14),

		db
			.select({
				label: supplies.name,
				value: sql<string>`${supplies.quantity}`,
				reorder: sql<string>`${supplies.reorderLevel}`
			})
			.from(supplies)
			.where(
				all([
					stockWhere,
					sql`${supplies.reorderLevel} IS NOT NULL AND ${supplies.quantity} <= ${supplies.reorderLevel}`
				])
			)
			.orderBy(supplies.quantity)
			.limit(14)
	]);

	const stats: Stat[] = [
		{
			key: 'stock-added',
			label: 'Stock Added',
			value: n(movements?.added),
			format: 'count',
			group: 'Stock',
			hint: `${n(movements?.entries)} movements across ${n(movements?.items)} supplies`,
			section: 'supply-adjustments',
			tone: 'positive'
		},
		{
			key: 'stock-taken',
			label: 'Stock Taken',
			value: n(movements?.taken),
			format: 'count',
			group: 'Stock',
			hint: 'Units consumed or issued out',
			section: 'supply-adjustments',
			tone: 'warning'
		},
		{
			key: 'stock-purchase-cost',
			label: 'Stock Purchased',
			value: n(movements?.purchaseCost),
			format: 'money',
			group: 'Stock',
			hint: 'Cost of everything received',
			section: 'supply-adjustments',
			tone: 'negative'
		},
		{
			key: 'stock-consumed-value',
			label: 'Stock Consumed',
			value: Math.abs(n(movements?.consumedValue)),
			format: 'money',
			group: 'Stock',
			hint: 'Value of what left the store room',
			section: 'supply-adjustments',
			tone: 'warning'
		},
		{
			key: 'stock-damaged',
			label: 'Damaged Units',
			value: n(damage?.quantity),
			format: 'count',
			group: 'Stock',
			hint: `${n(damage?.reports)} reports · ${n(damage?.deductable)} charged to staff`,
			section: 'damaged-supplies',
			tone: 'negative'
		},
		{
			key: 'stock-on-hand',
			label: 'Units On Hand',
			value: n(onHand?.quantity),
			format: 'count',
			group: 'Stock',
			hint: `Across ${n(onHand?.items)} supplies`,
			section: 'stock',
			tone: 'neutral'
		},
		{
			key: 'stock-below-reorder',
			label: 'Below Reorder Level',
			value: n(onHand?.belowReorder),
			format: 'count',
			group: 'Stock',
			hint: `${n(onHand?.empty)} completely out`,
			section: 'stock',
			tone: n(onHand?.belowReorder) > 0 ? 'warning' : 'positive'
		}
	];

	const charts: ReportChartData[] = [
		{
			key: 'stock-flow',
			title: 'Stock In and Out',
			description: 'Units received against units consumed, month by month.',
			group: 'Stock',
			kind: 'bar',
			labels: keys,
			wide: true,
			series: [
				{ label: 'Added', data: alignMonths(keys, movementsByMonth, (row) => n(row.added)) },
				{ label: 'Taken', data: alignMonths(keys, movementsByMonth, (row) => -n(row.taken)) }
			]
		},
		{
			key: 'stock-spend',
			title: 'Stock Purchase Spend',
			group: 'Stock',
			kind: 'line',
			labels: keys,
			money: true,
			series: [
				{ label: 'Purchases', data: alignMonths(keys, movementsByMonth, (row) => n(row.cost)) }
			]
		},
		{
			key: 'stock-by-type',
			title: 'Movement by Supply Type',
			group: 'Stock',
			kind: 'doughnut',
			labels: topN(byType.map(toBreakdown)).map((row) => row.label),
			series: [
				{ label: 'Units moved', data: topN(byType.map(toBreakdown)).map((row) => row.value) }
			]
		},
		{
			key: 'stock-top-consumed',
			title: 'Most Consumed Supplies',
			group: 'Stock',
			kind: 'bar',
			labels: bySupply.map((row) => row.label ?? 'Unknown'),
			series: [{ label: 'Units taken', data: bySupply.map((row) => n(row.value)) }]
		},
		{
			key: 'stock-by-supplier',
			title: 'Spend by Supplier',
			group: 'Stock',
			kind: 'bar',
			money: true,
			labels: topN(bySupplier.map(toBreakdown), 10).map((row) => row.label),
			series: [
				{ label: 'Purchased', data: topN(bySupplier.map(toBreakdown), 10).map((row) => row.value) }
			]
		},
		{
			key: 'stock-by-handler',
			title: 'Movements by Employee',
			group: 'Stock',
			kind: 'bar',
			labels: byHandler.map((row) => row.label || 'Unassigned'),
			series: [{ label: 'Movements', data: byHandler.map((row) => n(row.value)) }]
		},
		{
			key: 'stock-damage',
			title: 'Damage by Supply',
			group: 'Stock',
			kind: 'bar',
			labels: damageBySupply.map((row) => row.label ?? 'Unknown'),
			series: [{ label: 'Units damaged', data: damageBySupply.map((row) => n(row.value)) }]
		},
		{
			key: 'stock-levels',
			title: 'Largest Stock Holdings',
			group: 'Stock',
			kind: 'bar',
			labels: stockLevels.map((row) => row.label ?? 'Unknown'),
			series: [{ label: 'On hand', data: stockLevels.map((row) => n(row.value)) }]
		},
		{
			key: 'stock-reorder',
			title: 'Supplies Below Reorder Level',
			description: 'Current level against the line that should trigger a purchase.',
			group: 'Stock',
			kind: 'bar',
			labels: belowReorder.map((row) => row.label ?? 'Unknown'),
			series: [
				{ label: 'On hand', data: belowReorder.map((row) => n(row.value)) },
				{ label: 'Reorder level', data: belowReorder.map((row) => n(row.reorder)) }
			]
		}
	];

	return { stats, charts };
}

function toBreakdown(row: { label: string | null; value: string | number }) {
	return { label: row.label, value: n(row.value) };
}
