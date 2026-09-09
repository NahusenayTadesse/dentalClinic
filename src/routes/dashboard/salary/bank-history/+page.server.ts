import { db } from '$lib/server/db';
import {
	paymentMethods,
	bankAmount,
	bankInsertHistory,
	user,
	transactions
} from '$lib/server/db/schema';
import { and, desc, eq, count } from 'drizzle-orm';
import { notDeleted } from '$lib/server/softDelete';

import { parseTableQuery, buildWhere, pagination, currentQuery } from '$lib/server/queryFilters';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const query = parseTableQuery(url, ['paymentMethodId', 'recievedById']);

	const bankAccounts = await db
		.select({
			id: bankAmount.id,
			paymentMethod: paymentMethods.name,
			account: bankAmount.account,
			amount: bankAmount.amount
		})
		.from(bankAmount)
		.leftJoin(paymentMethods, eq(bankAmount.paymentMethodId, paymentMethods.id));

	// --- Build WHERE conditions ---
	// The date filter only applies when both ends are actually present —
	// no default range, matching the other query-builder pages.
	const whereClause = buildWhere(query, {
		dateColumn: bankInsertHistory.createdAt,
		filters: {
			paymentMethodId: (v) => eq(bankAmount.paymentMethodId, Number(v)),
			recievedById: (v) => eq(bankInsertHistory.createdBy, v)
		}
	});

	// --- Filter option lists ---
	const [paymentMethodOptions, userOptions] = await Promise.all([
		db.select({ id: paymentMethods.id, name: paymentMethods.name }).from(paymentMethods),
		db.select({ id: user.id, name: user.name }).from(user)
	]);

	// --- Total count (needs the same joins the WHERE depends on) ---
	const [{ total }] = await db
		.select({ total: count() })
		.from(bankInsertHistory)
		.leftJoin(bankAmount, eq(bankInsertHistory.bankAmountId, bankAmount.id))
		.where(whereClause);

	// --- Main query ---
	let allTransactions = await db
		.select({
			id: bankInsertHistory.id,
			date: bankInsertHistory.createdAt,
			amount: bankInsertHistory.amount,
			bank: paymentMethods.name,
			description: bankInsertHistory.reason,
			recievedBy: user.name,
			recievedById: user.id,
			recieptLink: transactions.recieptLink
		})
		.from(bankInsertHistory)
		.leftJoin(
			transactions,
			and(eq(transactions.id, bankInsertHistory.transactionId), notDeleted(transactions))
		)
		.leftJoin(bankAmount, eq(bankInsertHistory.bankAmountId, bankAmount.id))
		.leftJoin(paymentMethods, eq(bankAmount.paymentMethodId, paymentMethods.id))
		.leftJoin(user, eq(bankInsertHistory.createdBy, user.id))
		.where(whereClause)
		.groupBy(
			bankInsertHistory.id,
			bankInsertHistory.createdAt,
			bankInsertHistory.amount,
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
		bankAccounts,
		pagination: pagination(query, total),
		filterOptions: {
			paymentMethods: paymentMethodOptions,
			users: userOptions
		},
		currentQuery: currentQuery(query)
	};
};
