import { db } from '$lib/server/db';
import { paymentMethods, transactions, expenses, expensesType, user } from '$lib/server/db/schema';
import { and, desc, eq, sql } from 'drizzle-orm';
import { notDeleted } from '$lib/server/softDelete';

import { currentMonthFilter } from '$lib/global.svelte';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	const { range } = params as { range: string };

	const [y1, m1, d1, y2, m2, d2] = range.split('-');

	const start = `${y1}-${m1}-${d1}`;
	const end = `${y2}-${m2}-${d2}`;

	const allTransactions = await db
		.select({
			id: transactions.id,
			date: transactions.createdAt,
			expenseType: expensesType.name,
			amount: expenses.total,
			paymentMethods: paymentMethods.name,
			recievedBy: user.name,
			recievedById: user.id,
			recieptLink: transactions.recieptLink
		})
		.from(expenses)
		.leftJoin(
			transactions,
			and(eq(expenses.transactionId, transactions.id), notDeleted(transactions))
		)
		.leftJoin(expensesType, and(eq(expenses.type, expensesType.id), notDeleted(expensesType)))
		.leftJoin(paymentMethods, eq(transactions.paymentMethodId, paymentMethods.id))
		.leftJoin(user, eq(transactions.createdBy, user.id))
		.where(currentMonthFilter(transactions.createdAt, start, end))
		.groupBy(
			transactions.id,
			transactions.createdAt,
			transactions.amount,
			paymentMethods.name,
			user.name,
			user.id,
			transactions.recieptLink
		)
		.orderBy(desc(transactions.createdAt));

	return {
		allTransactions,
		start,
		end
	};
};
