import { db } from '$lib/server/db';
import { supplies, supplyTypes } from '$lib/server/db/schema';
import { and, asc, eq, isNull, like, or } from 'drizzle-orm';
import { notDeleted } from '$lib/server/softDelete';
import {
	parseTableQuery,
	buildWhere,
	pagination,
	currentQuery,
	paginate
} from '$lib/server/queryFilters';
import { UNSPECIFIED_UNIT } from './filters';
import type { PageServerLoad } from '../$types';
import { onHand } from '$lib/server/stock';

export const load: PageServerLoad = async ({ url }) => {
	const query = parseTableQuery(url, ['supplyTypeId', 'kind', 'unitOfMeasure', 'stockStatus']);

	const whereClause = buildWhere(query, {
		base: [notDeleted(supplies)],
		search: (term) => or(like(supplies.name, `%${term}%`), like(supplies.description, `%${term}%`)),
		dateColumn: supplies.createdAt,
		filters: {
			supplyTypeId: (v) => eq(supplies.supplyTypeId, Number(v)),
			kind: (v) =>
				v === 'returnable' || v === 'consumable'
					? eq(supplies.returnable, v === 'returnable')
					: undefined,
			// The unit is nullable, so "unspecified" is a real choice on the list.
			unitOfMeasure: (v) =>
				v === UNSPECIFIED_UNIT ? isNull(supplies.unitOfMeasure) : eq(supplies.unitOfMeasure, v)
		}
	});

	// --- Filter option lists (the whole catalogue, not just the current page) ---
	const [typeOptions, unitRows] = await Promise.all([
		db
			.select({ id: supplyTypes.id, name: supplyTypes.name })
			.from(supplyTypes)
			.where(notDeleted(supplyTypes))
			.orderBy(asc(supplyTypes.name)),
		db
			.selectDistinct({ unit: supplies.unitOfMeasure })
			.from(supplies)
			.where(notDeleted(supplies))
			.orderBy(asc(supplies.unitOfMeasure))
	]);

	const supplyList = await db
		.select({
			id: supplies.id,
			name: supplies.name,
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
		const onHand = Number(row.quantity ?? 0);
		const belowReorder = row.reorderLevel != null && onHand <= Number(row.reorderLevel);

		return {
			...row,
			onHand,
			kind: row.returnable ? 'Returnable' : 'Consumable',
			unitOfMeasure: row.unitOfMeasure ?? UNSPECIFIED_UNIT,
			belowReorder,
			stockStatus: onHand === 0 ? 'out-of-stock' : belowReorder ? 'at-reorder' : 'in-stock'
		};
	});

	/**
	 * `stockStatus` is worked out in JS from the reorder level, so it narrows the rows here
	 * rather than in the `WHERE`. `paginate` then slices what is left, keeping the shape a
	 * SQL-paginated page returns.
	 */
	const narrowed = rows.filter(
		(row) => !query.filters.stockStatus || row.stockStatus === query.filters.stockStatus
	);

	const { rows: paged, total } = paginate(narrowed, query);

	return {
		supplyList: paged,
		pagination: pagination(query, total),
		filterOptions: {
			supplyTypes: typeOptions,
			units: [...new Set(unitRows.map((row) => row.unit || UNSPECIFIED_UNIT))]
		},
		currentQuery: currentQuery(query)
	};
};
