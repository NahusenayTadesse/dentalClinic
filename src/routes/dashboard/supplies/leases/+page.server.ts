import { db } from '$lib/server/db';
import { site, supplyLeaseItems, supplyLeases, user } from '$lib/server/db/schema';
import { and, asc, desc, eq, like, or, sql } from 'drizzle-orm';
import { notDeleted } from '$lib/server/softDelete';
import { leaseStatusLabel } from '$lib/leaseStatus';
import {
	parseTableQuery,
	buildWhere,
	pagination,
	currentQuery,
	paginate
} from '$lib/server/queryFilters';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const query = parseTableQuery(url, [
		'siteId',
		'status',
		'requestedById',
		'dueStatus',
		'settlement'
	]);

	const whereClause = buildWhere(query, {
		base: [notDeleted(supplyLeases)],
		search: (term) =>
			or(
				like(supplyLeases.referenceNumber, `%${term}%`),
				like(supplyLeases.reason, `%${term}%`),
				like(site.name, `%${term}%`)
			),
		dateColumn: supplyLeases.requestedAt,
		filters: {
			siteId: (v) => eq(supplyLeases.siteId, Number(v)),
			// The enum is validated by the column itself; an unknown value simply
			// matches nothing rather than erroring.
			status: (v) => sql`${supplyLeases.status} = ${v}`,
			requestedById: (v) => eq(supplyLeases.requestedBy, v)
			// `dueStatus` and `settlement` are worked out from the rolled-up
			// quantities below, so they narrow after the query rather than in the WHERE.
		}
	});

	// --- Filter option lists: only the sites and people that actually appear ---
	const [siteOptions, requesterOptions] = await Promise.all([
		db
			.select({ id: site.id, name: site.name })
			.from(site)
			.where(
				and(
					sql`${site.id} IN (SELECT DISTINCT site_id FROM ${supplyLeases} WHERE ${supplyLeases.deletedAt} IS NULL)`,
					notDeleted(site)
				)
			)
			.orderBy(asc(site.name)),
		db
			.select({ id: user.id, name: user.name })
			.from(user)
			.where(
				sql`${user.id} IN (SELECT DISTINCT requested_by FROM ${supplyLeases} WHERE ${supplyLeases.deletedAt} IS NULL)`
			)
			.orderBy(asc(user.name))
	]);

	/**
	 * One row per lease with its lines rolled up, so the table can show what a
	 * lease is worth without a second query per row.
	 *
	 * The `user` joins are deliberately left unfiltered by `notDeleted`: a
	 * deleted user still requested and approved what they requested and
	 * approved, and blanking the name out would erase the audit trail this page
	 * exists to show.
	 */
	const leaseList = await db
		.select({
			id: supplyLeases.id,
			referenceNumber: supplyLeases.referenceNumber,
			site: site.name,
			siteId: supplyLeases.siteId,
			status: supplyLeases.status,
			reason: supplyLeases.reason,
			requestedBy: user.name,
			// Carried so the table can link the name to the user's admin page.
			// Nulled for a deleted user: the name still prints (they did still
			// request it) but `admin-panel/users/[id]` filters them out, so the
			// link would lead to a dead page.
			requestedById: sql<string | null>`CASE WHEN ${user.deletedAt} IS NULL THEN ${user.id} END`,
			// Raw dates, not preformatted strings: the column formats them with
			// `formatEthiopianDate` for display while sorting stays chronological
			// on the underlying value.
			requestedAt: supplyLeases.requestedAt,
			expectedReturnDate: supplyLeases.expectedReturnDate,
			itemCount: sql<number>`COUNT(DISTINCT ${supplyLeaseItems.id})`,
			requested: sql<number>`COALESCE(SUM(${supplyLeaseItems.quantityRequested}), 0)`,
			issued: sql<number>`COALESCE(SUM(${supplyLeaseItems.quantityIssued}), 0)`,
			outstanding: sql<number>`COALESCE(SUM(CASE WHEN ${supplyLeaseItems.returnable} = 1
				THEN GREATEST(${supplyLeaseItems.quantityIssued}
					- ${supplyLeaseItems.quantityReturned}
					- ${supplyLeaseItems.quantityWrittenOff}, 0)
				ELSE 0 END), 0)`,
			/** Only the lines that actually left the store are worth anything. */
			value: sql<number>`COALESCE(SUM(${supplyLeaseItems.quantityIssued} * COALESCE(${supplyLeaseItems.unitCost}, 0)), 0)`
		})
		.from(supplyLeases)
		.leftJoin(site, and(eq(supplyLeases.siteId, site.id), notDeleted(site)))
		.leftJoin(user, eq(supplyLeases.requestedBy, user.id))
		.leftJoin(
			supplyLeaseItems,
			and(eq(supplyLeaseItems.leaseId, supplyLeases.id), notDeleted(supplyLeaseItems))
		)
		.where(whereClause)
		.groupBy(
			supplyLeases.id,
			supplyLeases.referenceNumber,
			site.name,
			supplyLeases.siteId,
			supplyLeases.status,
			supplyLeases.reason,
			user.name,
			user.id,
			user.deletedAt,
			supplyLeases.requestedAt,
			supplyLeases.expectedReturnDate
		)
		.orderBy(desc(supplyLeases.requestedAt), desc(supplyLeases.id));

	const today = new Date();
	const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
	const WEEK = 7 * 86400000;

	const rows = leaseList.map((row) => {
		const due = row.expectedReturnDate ? new Date(row.expectedReturnDate) : null;
		const dueDay =
			due && !isNaN(due.getTime())
				? new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime()
				: null;

		const outstanding = Number(row.outstanding ?? 0);
		// Only a lease that still owes goods back can be overdue; a closed or
		// fully returned one has nothing left to chase.
		const overdue = outstanding > 0 && dueDay !== null && dueDay < startOfToday;

		return {
			...row,
			itemCount: Number(row.itemCount ?? 0),
			requested: Number(row.requested ?? 0),
			issued: Number(row.issued ?? 0),
			outstanding,
			value: Number(row.value ?? 0),
			statusLabel: leaseStatusLabel(row.status),
			dueStatus: !dueDay
				? 'no-due-date'
				: outstanding === 0
					? 'nothing-owed'
					: overdue
						? 'overdue'
						: dueDay <= startOfToday + WEEK
							? 'due-soon'
							: 'not-due',
			overdue,
			/** Days past due, shown on the overdue rows. */
			daysOverdue: overdue && dueDay ? Math.floor((startOfToday - dueDay) / 86400000) : 0,
			settlement: outstanding > 0 ? 'still-out' : 'settled'
		};
	});

	/**
	 * Both of these read the rolled-up quantities against today's date, which is
	 * worked out in JS above, so they narrow the rows here. `paginate` then
	 * slices what is left, keeping the shape a SQL-paginated page returns.
	 */
	const narrowed = rows.filter(
		(row) =>
			(!query.filters.dueStatus || row.dueStatus === query.filters.dueStatus) &&
			(!query.filters.settlement || row.settlement === query.filters.settlement)
	);

	const { rows: paged, total } = paginate(narrowed, query);

	/** Section totals, over the whole filtered set rather than the current page. */
	const outstandingUnits = narrowed.reduce((sum, lease) => sum + lease.outstanding, 0);
	const awaitingApproval = narrowed.filter((lease) => lease.status === 'pending').length;

	return {
		leaseList: paged,
		outstandingUnits,
		awaitingApproval,
		pagination: pagination(query, total),
		filterOptions: {
			sites: siteOptions,
			requesters: requesterOptions
		},
		currentQuery: currentQuery(query)
	};
};
