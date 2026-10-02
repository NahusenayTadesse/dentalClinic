import { count, desc, eq, like, or, sql, type SQL } from 'drizzle-orm';

import type { SelectedFields } from 'drizzle-orm/mysql-core';

import { db } from '$lib/server/db';
import { joinedSelect } from '$lib/server/db/joinedSelect';
import { paymentMethods, transactions, user } from '$lib/server/db/schema';
import { notDeleted } from '$lib/server/softDelete';
import { branchFilter } from '$lib/server/branchScope';
import {
	buildWhere,
	currentQuery,
	facetCounts,
	orderBy,
	pagination,
	parseTableQuery,
	type WhereSpec
} from '$lib/server/queryFilters';
import type { PageServerLoad } from './$types';

/**
 * Every money movement at this branch — payments in, payroll and expenses out — filtered, faceted
 * and totalled in SQL, like the patient list.
 *
 * It used to stack two filter components: a server-side bar that paged the rows, and a client-side
 * menu that then counted *the page* — so its tallies described twenty rows and were shown as the
 * result. One server-driven table now counts everything the filters match. It was also not branch
 * scoped, though `transactions` is (CLAUDE.md §15).
 */

const FILTERS = [
	'direction',
	'paymentMethodId',
	'paymentStatus',
	'approvalStatus',
	'recievedById'
] as const;
type Filter = (typeof FILTERS)[number];

const DIRECTIONS = transactions.direction.enumValues;
const PAYMENT_STATUSES = transactions.paymentStatus.enumValues;
const APPROVAL_STATUSES = transactions.approvalStatus.enumValues;

/** Narrows a URL value to one of an enum's values, so a hand-typed one matches nothing. */
function oneOf<T extends string>(values: readonly T[], value: string): value is T {
	return (values as readonly string[]).includes(value);
}

const SORTABLE = {
	date: transactions.createdAt,
	amount: transactions.amount,
	paymentMethod: paymentMethods.name,
	recievedBy: user.name
};

export const load: PageServerLoad = async ({ url, locals }) => {
	const query = parseTableQuery(url, FILTERS, 25, Object.keys(SORTABLE));

	const spec: WhereSpec<Filter> = {
		// A deleted payment's transaction must not keep showing its money here.
		base: [notDeleted(transactions), branchFilter(transactions.branchId, locals.branch)],
		search: (term) =>
			or(
				like(transactions.description, `%${term}%`),
				like(transactions.receiptNumber, `%${term}%`)
			),
		dateColumn: transactions.createdAt,
		filters: {
			direction: (v) => (oneOf(DIRECTIONS, v) ? eq(transactions.direction, v) : sql`false`),
			paymentMethodId: (v) => eq(transactions.paymentMethodId, Number(v)),
			paymentStatus: (v) =>
				oneOf(PAYMENT_STATUSES, v) ? eq(transactions.paymentStatus, v) : sql`false`,
			approvalStatus: (v) =>
				oneOf(APPROVAL_STATUSES, v) ? eq(transactions.approvalStatus, v) : sql`false`,
			// varchar — no Number() cast
			recievedById: (v) => eq(transactions.createdBy, v)
		}
	};
	const where = buildWhere(query, spec);

	const joined = <T extends SelectedFields>(fields: T) =>
		joinedSelect(fields, transactions)
			.leftJoin(paymentMethods, eq(transactions.paymentMethodId, paymentMethods.id))
			// Attribution, not filtered: a deleted user still took the money (§9).
			.leftJoin(user, eq(transactions.createdBy, user.id));

	const [rows, [totals]] = await Promise.all([
		joined({
			id: transactions.id,
			date: transactions.createdAt,
			direction: transactions.direction,
			amount: transactions.amount,
			paymentMethod: paymentMethods.name,
			paymentStatus: transactions.paymentStatus,
			approvalStatus: transactions.approvalStatus,
			receiptNumber: transactions.receiptNumber,
			description: transactions.description,
			recievedBy: user.name,
			recievedById: user.id,
			recieptLink: transactions.recieptLink
		})
			.where(where)
			.orderBy(
				...(orderBy(query, SORTABLE) ?? [desc(transactions.createdAt)]),
				desc(transactions.id)
			)
			.limit(query.limit)
			.offset(query.offset),
		db
			.select({
				total: count(),
				moneyIn: sql<string>`coalesce(sum(case when ${transactions.direction} = 'in' then ${transactions.amount} else 0 end), 0)`,
				moneyOut: sql<string>`coalesce(sum(case when ${transactions.direction} = 'out' then abs(${transactions.amount}) else 0 end), 0)`
			})
			.from(transactions)
			.where(where)
	]);

	/** A facet: every filter applied but its own (`facetCounts`). */
	const facet = async (
		value: SQL<string | number | null>,
		label: SQL<string | null>,
		except: Filter
	) =>
		joined({ value, label, count: count() })
			.where(buildWhere(query, spec, { except }))
			.groupBy(value, label);

	const facets = await facetCounts({
		direction: () =>
			facet(
				sql`${transactions.direction}`,
				sql<string>`case when ${transactions.direction} = 'in' then 'Money in' else 'Money out' end`,
				'direction'
			),
		paymentMethod: () =>
			facet(sql`${paymentMethods.id}`, sql`${paymentMethods.name}`, 'paymentMethodId'),
		paymentStatus: () =>
			facet(
				sql`${transactions.paymentStatus}`,
				sql`${transactions.paymentStatus}`,
				'paymentStatus'
			),
		approvalStatus: () =>
			facet(
				sql`${transactions.approvalStatus}`,
				sql`${transactions.approvalStatus}`,
				'approvalStatus'
			),
		recievedBy: () => facet(sql`${user.id}`, sql`${user.name}`, 'recievedById')
	});

	const moneyIn = Number(totals?.moneyIn ?? 0);
	const moneyOut = Number(totals?.moneyOut ?? 0);
	return {
		rows,
		totals: { count: Number(totals?.total ?? 0), moneyIn, moneyOut, net: moneyIn - moneyOut },
		facets,
		pagination: pagination(query, totals?.total ?? 0),
		currentQuery: currentQuery(query)
	};
};
