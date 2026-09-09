import { db } from '$lib/server/db';
import {
	customers,
	site,
	user,
	address,
	subcity,
	siteMonthlyPayments,
	siteContracts
} from '$lib/server/db/schema';
import { isApproved } from '$lib/server/approvals';
import { and, eq, or, like, sql, count } from 'drizzle-orm';
import { notDeleted } from '$lib/server/softDelete';
import { parseTableQuery, buildWhere, pagination, currentQuery } from '$lib/server/queryFilters';
import type { PageServerLoad } from '../$types';

export const load: PageServerLoad = async ({ url }) => {
	const query = parseTableQuery(url, ['customerId', 'subcityId', 'addedById']);

	const whereClause = buildWhere(query, {
		// Only approved sites belong in the main list; the rest sit in the approval queue.
		base: [eq(site.isActive, true), notDeleted(site), isApproved(site)!],
		search: (term) =>
			or(
				like(site.name, `%${term}%`),
				like(customers.name, `%${term}%`),
				like(site.phone, `%${term}%`)
			),
		filters: {
			customerId: (v) => eq(site.customerId, Number(v)),
			subcityId: (v) => eq(address.subcityId, Number(v)),
			addedById: (v) => eq(site.createdBy, v)
		}
	});

	// --- Filter option lists for the selects ---
	const [customerOptions, subcityOptions, userOptions] = await Promise.all([
		db
			.select({ id: customers.id, name: customers.name })
			.from(customers)
			.where(notDeleted(customers)),
		db.select({ id: subcity.id, name: subcity.name }).from(subcity),
		db.select({ id: user.id, name: user.name }).from(user)
	]);

	// --- Total count (needs the same joins the WHERE clause depends on) ---
	const [{ total }] = await db
		.select({ total: count() })
		.from(site)
		.leftJoin(customers, and(eq(customers.id, site.customerId), notDeleted(customers)))
		.leftJoin(address, and(eq(address.id, site.address), notDeleted(address)))
		.where(whereClause);

	// --- Main query ---
	const siteList = await db
		.select({
			id: site.id,
			name: site.name,
			customerName: customers.name,
			customerId: site.customerId,
			phone: site.phone,
			startedOn: sql<string>`DATE_FORMAT(${site.startDate}, '%Y-%m-%d')`,
			addedBy: user.name,
			addedById: user.id,
			address: {
				id: address.id,
				street: address.street,
				subcity: subcity.name,
				subcityId: subcity.id,
				kebele: address.kebele,
				buildingNumber: address.buildingNumber,
				floor: address.floor,
				houseNumber: address.houseNumber,
				status: address.status
			},

			expectedPayments: sql<number>`
				GREATEST(0, TIMESTAMPDIFF(MONTH, ${siteContracts.startDate}, CURRENT_DATE()) + 1)
			`.as('expected'),

			actualPayments: sql<number>`
				(SELECT COUNT(*)
				 FROM ${siteMonthlyPayments}
				 WHERE ${siteMonthlyPayments.contractId} = ${siteContracts.id})
			`.as('actual'),

			missingPayments: sql<number>`
				GREATEST(0,
					(TIMESTAMPDIFF(MONTH, ${siteContracts.startDate}, CURRENT_DATE()) + 1) -
					(SELECT COUNT(*) FROM ${siteMonthlyPayments} WHERE ${siteMonthlyPayments.contractId} = ${siteContracts.id})
				)
			`
		})
		.from(site)
		.leftJoin(siteContracts, and(eq(siteContracts.siteId, site.id), notDeleted(siteContracts)))
		.leftJoin(user, eq(site.createdBy, user.id))
		.leftJoin(customers, and(eq(customers.id, site.customerId), notDeleted(customers)))
		.leftJoin(address, and(eq(address.id, site.address), notDeleted(address)))
		.leftJoin(subcity, and(eq(subcity.id, address.subcityId), notDeleted(subcity)))
		.where(whereClause)
		.groupBy(site.id, siteContracts.id)
		.limit(query.limit)
		.offset(query.offset);

	return {
		siteList,
		pagination: pagination(query, total),
		filterOptions: {
			customers: customerOptions,
			subcities: subcityOptions,
			users: userOptions
		},
		currentQuery: currentQuery(query)
	};
};
