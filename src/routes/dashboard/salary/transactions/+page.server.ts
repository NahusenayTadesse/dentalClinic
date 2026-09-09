import { db } from '$lib/server/db';
import { paymentMethods, transactions, user } from '$lib/server/db/schema';
import { desc, eq, count } from 'drizzle-orm';
import { notDeleted } from '$lib/server/softDelete';

import { parseTableQuery, buildWhere, pagination, currentQuery } from '$lib/server/queryFilters';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const query = parseTableQuery(url, ['paymentMethodId', 'recievedById']);

	const whereClause = buildWhere(query, {
		// A deleted payment's transaction must not keep showing its money here — this
		// is the one listing that reads `transactions` without going through a parent.
		base: [notDeleted(transactions)],
		dateColumn: transactions.createdAt,
		filters: {
			paymentMethodId: (v) => eq(transactions.paymentMethodId, Number(v)),
			recievedById: (v) => eq(transactions.createdBy, v)
		}
	});

	// --- Filter option lists ---
	const [paymentMethodOptions, userOptions] = await Promise.all([
		db.select({ id: paymentMethods.id, name: paymentMethods.name }).from(paymentMethods),
		db.select({ id: user.id, name: user.name }).from(user)
	]);

	// --- Total count ---
	const [{ total }] = await db.select({ total: count() }).from(transactions).where(whereClause);

	// --- Main query ---
	const allTransactions = await db
		.select({
			id: transactions.id,
			date: transactions.createdAt,
			amount: transactions.amount,
			paymentMethods: paymentMethods.name,
			description: transactions.description,
			recievedBy: user.name,
			recievedById: user.id,
			recieptLink: transactions.recieptLink
		})
		.from(transactions)
		.leftJoin(paymentMethods, eq(transactions.paymentMethodId, paymentMethods.id))
		.leftJoin(user, eq(transactions.createdBy, user.id))
		.where(whereClause)
		.groupBy(
			transactions.id,
			transactions.createdAt,
			transactions.amount,
			paymentMethods.name,
			user.name,
			user.id,
			transactions.recieptLink
		)
		.orderBy(desc(transactions.createdAt))
		.limit(query.limit)
		.offset(query.offset);

	return {
		allTransactions,
		pagination: pagination(query, total),
		filterOptions: {
			paymentMethods: paymentMethodOptions,
			users: userOptions
		},
		currentQuery: currentQuery(query)
	};
};
