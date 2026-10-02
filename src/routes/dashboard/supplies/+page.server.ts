import { db } from '$lib/server/db';
import { supplies, supplyTypes } from '$lib/server/db/schema';
import { and, asc, eq, like, or } from 'drizzle-orm';
import { notDeleted } from '$lib/server/softDelete';
import {
	parseTableQuery,
	buildWhere,
	pagination,
	currentQuery,
	paginate,
	facetInMemory
} from '$lib/server/queryFilters';
import { STOCK_STATUSES, SUPPLY_KINDS, UNSPECIFIED_UNIT } from './filters';
import type { PageServerLoad } from './$types';
import { onHand } from '$lib/server/stock';

export const load: PageServerLoad = async ({ url }) => {
	const query = parseTableQuery(url, ['supplyTypeId', 'kind', 'unitOfMeasure', 'stockStatus']);

	// Search and the date window narrow the catalogue in SQL; the column filters are applied in
	// memory below, because stock status is worked out from the lots, not stored.
	const whereClause = buildWhere(query, {
		base: [notDeleted(supplies)],
		search: (term) => or(like(supplies.name, `%${term}%`), like(supplies.description, `%${term}%`)),
		dateColumn: supplies.createdAt
	});

	const supplyList = await db
		.select({
			id: supplies.id,
			name: supplies.name,
			supplyTypeId: supplies.supplyTypeId,
			type: supplyTypes.name,
			description: supplies.description,
			quantity: onHand(),
			returnable: supplies.returnable,
			reorderLevel: supplies.reorderLevel,
			unitOfMeasure: supplies.unitOfMeasure
		})
		.from(supplies)
		.leftJoin(supplyTypes, and(eq(supplies.supplyTypeId, supplyTypes.id), notDeleted(supplyTypes)))
		.where(whereClause)
		// Pagination needs a stable order or page 2 is undefined.
		.orderBy(asc(supplies.name), asc(supplies.id));

	const rows = supplyList.map((row) => {
		// Stock on hand is derived from the item's open lots — see `server/stock.ts`.
		const stock = Number(row.quantity ?? 0);
		const belowReorder = row.reorderLevel != null && stock <= Number(row.reorderLevel);
		const stockStatus = stock === 0 ? 'out-of-stock' : belowReorder ? 'at-reorder' : 'in-stock';
		return {
			...row,
			onHand: stock,
			kind: row.returnable ? 'returnable' : 'consumable',
			unitOfMeasure: row.unitOfMeasure ?? UNSPECIFIED_UNIT,
			belowReorder,
			stockStatus
		};
	});

	/*
	 * The column filters and their counts, over the whole catalogue, in memory — stock status
	 * cannot be a SQL facet. It used to be a separate filter bar whose dropdowns had no counts.
	 */
	const label = (options: { value: string; name: string }[], value: string) =>
		options.find((o) => o.value === value)?.name ?? value;
	const { rows: narrowed, facets } = facetInMemory(rows, query, {
		supplyTypeId: {
			key: 'type',
			value: (r) => (r.supplyTypeId === null ? null : String(r.supplyTypeId)),
			label: (r) => r.type
		},
		kind: { key: 'kind', value: (r) => r.kind, label: (r) => label(SUPPLY_KINDS, r.kind) },
		unitOfMeasure: {
			key: 'unitOfMeasure',
			value: (r) => r.unitOfMeasure,
			label: (r) => (r.unitOfMeasure === UNSPECIFIED_UNIT ? 'Not given' : r.unitOfMeasure)
		},
		stockStatus: {
			key: 'stockStatus',
			value: (r) => r.stockStatus,
			label: (r) => label(STOCK_STATUSES, r.stockStatus)
		}
	});

	const { rows: paged, total } = paginate(narrowed, query);
	return {
		supplyList: paged,
		facets,
		atReorder: rows.filter((r) => r.stockStatus !== 'in-stock').length,
		pagination: pagination(query, total),
		currentQuery: currentQuery(query)
	};
};
