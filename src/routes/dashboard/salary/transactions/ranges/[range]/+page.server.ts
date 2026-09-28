import { db } from '$lib/server/db';
import { paymentMethods, transactions, user } from '$lib/server/db/schema';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
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
		.where(and(currentMonthFilter(transactions.createdAt, start, end), notDeleted(transactions)))
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
