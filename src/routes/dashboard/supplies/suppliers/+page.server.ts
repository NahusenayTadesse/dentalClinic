import { and, asc, eq, like, or, sql } from 'drizzle-orm';
import { notDeleted } from '$lib/server/softDelete';
import {
	parseTableQuery,
	buildWhere,
	pagination,
	currentQuery,
	paginate,
	facetInMemory
} from '$lib/server/queryFilters';
import { SUPPLIER_ACTIVITY, SUPPLIER_CONTACT, SUPPLIER_STATUSES } from '../filters';
import { currentMonthFilter } from '$lib/global.svelte';

import { db } from '$lib/server/db';
import { supplySuppliers, subcity, address, suppliesAdjustments } from '$lib/server/db/schema/';
import type { PageServerLoad } from './$types';
export const load: PageServerLoad = async ({ url }) => {
	const query = parseTableQuery(url, ['subcityId', 'status', 'contact', 'activity']);

	const whereClause = buildWhere(query, {
		base: [notDeleted(supplySuppliers)],
		search: (term) =>
			or(
				like(supplySuppliers.name, `%${term}%`),
				like(supplySuppliers.phone, `%${term}%`),
				like(supplySuppliers.email, `%${term}%`)
			)
		// The column filters are applied in memory below: `activity` counts deliveries, which only
		// exist once the rows are grouped, and the list is a clinic's handful of suppliers.
	});

	/**
	 * The date range scopes the *trading history*, not the supplier: it sits in
	 * the join rather than the WHERE so every supplier still appears, with their
	 * spend and delivery counts measured over the chosen window.
	 */
	const deliveredInRange =
		query.dateStart && query.dateEnd
			? currentMonthFilter(suppliesAdjustments.createdAt, query.dateStart, query.dateEnd)
			: undefined;

	const allData = await db
		.select({
			id: supplySuppliers.id,
			name: supplySuppliers.name,
			phone: supplySuppliers.phone,
			email: supplySuppliers.email,
			subcityId: address.subcityId,
			subcity: subcity.name,
			street: address.street,
			kebele: address.kebele,
			buildingNumber: address.buildingNumber,
			floor: address.floor,
			houseNumber: address.houseNumber,
			description: supplySuppliers.description,
			status: supplySuppliers.status,
			// Trading history, so the page can be filtered on more than a name:
			// how often this supplier has delivered, how many distinct items they
			// carry, what has been spent with them, and when they last delivered.
			deliveries: sql<number>`COUNT(DISTINCT ${suppliesAdjustments.id})`,
			itemsSupplied: sql<number>`COUNT(DISTINCT ${suppliesAdjustments.suppliesId})`,
			totalSpend: sql<number>`COALESCE(SUM(${suppliesAdjustments.total}), 0)`,
			lastDelivery: sql<Date | null>`MAX(${suppliesAdjustments.createdAt})`
		})
		.from(supplySuppliers)
		.leftJoin(address, and(eq(supplySuppliers.address, address.id), notDeleted(address)))
		.leftJoin(subcity, and(eq(address.subcityId, subcity.id), notDeleted(subcity)))
		.leftJoin(
			suppliesAdjustments,
			and(
				eq(suppliesAdjustments.supplierId, supplySuppliers.id),
				notDeleted(suppliesAdjustments),
				deliveredInRange
			)
		)
		.where(whereClause)
		.groupBy(
			supplySuppliers.id,
			supplySuppliers.name,
			supplySuppliers.phone,
			supplySuppliers.email,
			address.subcityId,
			subcity.name,
			address.street,
			address.kebele,
			address.buildingNumber,
			address.floor,
			address.houseNumber,
			supplySuppliers.description,
			supplySuppliers.status
		)
		// Pagination needs a stable order or page 2 is undefined.
		.orderBy(asc(supplySuppliers.name), asc(supplySuppliers.id));

	const rows = allData.map((row) => ({
		...row,
		totalSpend: Number(row.totalSpend ?? 0),
		deliveries: Number(row.deliveries ?? 0),
		itemsSupplied: Number(row.itemsSupplied ?? 0)
	}));

	/*
	 * The column filters and their counts, over every supplier the search matches — it used to be
	 * a separate filter bar whose dropdowns had no counts. An email that is present but blank is
	 * still "phone only".
	 */
	const nameOf = (options: { value: string; name: string }[], value: string) =>
		options.find((o) => o.value === value)?.name ?? value;
	const contactOf = (email: string | null) => (email?.trim() ? 'with-email' : 'phone-only');
	const activityOf = (deliveries: number) => (deliveries > 0 ? 'has-supplied' : 'never-supplied');
	const statusOf = (active: boolean) => (active ? 'active' : 'inactive');
	const { rows: narrowed, facets } = facetInMemory(rows, query, {
		subcityId: {
			key: 'subcity',
			value: (r) => (r.subcityId === null ? null : String(r.subcityId)),
			label: (r) => r.subcity
		},
		status: {
			key: 'status',
			value: (r) => statusOf(r.status),
			label: (r) => nameOf(SUPPLIER_STATUSES, statusOf(r.status))
		},
		contact: {
			key: 'email',
			value: (r) => contactOf(r.email),
			label: (r) => nameOf(SUPPLIER_CONTACT, contactOf(r.email))
		},
		activity: {
			key: 'deliveries',
			value: (r) => activityOf(r.deliveries),
			label: (r) => nameOf(SUPPLIER_ACTIVITY, activityOf(r.deliveries))
		}
	});

	const { rows: paged, total } = paginate(narrowed, query);

	return {
		allData: paged,
		facets,
		pagination: pagination(query, total),
		currentQuery: currentQuery(query)
	};
};
