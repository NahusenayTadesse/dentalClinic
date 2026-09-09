import { db } from '$lib/server/db';
import {
	paymentMethods,
	bankAmount,
	bankInsertHistory,
	user,
	transactions
} from '$lib/server/db/schema';
import { and, desc, eq } from 'drizzle-orm';
import { notDeleted } from '$lib/server/softDelete';

import { currentMonthFilter } from '$lib/global.svelte';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const { range } = params as { range: string };

	const [y1, m1, d1, y2, m2, d2] = range.split('-');

	const start = `${y1}-${m1}-${d1}`;
	const end = `${y2}-${m2}-${d2}`;

	const bankAccounts = await db
		.select({
			id: bankAmount.id,
			paymentMethod: paymentMethods.name,
			account: bankAmount.account,
			amount: bankAmount.amount
		})
		.from(bankAmount)
		.leftJoin(paymentMethods, eq(bankAmount.paymentMethodId, paymentMethods.id));

	const allTransactions = await db
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
		.where(currentMonthFilter(bankInsertHistory.createdAt, start, end))
		.groupBy(
			bankInsertHistory.id,
			bankInsertHistory.createdAt,
			bankInsertHistory.amount,
			paymentMethods.name,
			user.name,
			user.id,
			transactions.recieptLink
		)
		.orderBy(desc(transactions.createdAt));

	return {
		allTransactions,
		bankAccounts,
		start,
		end
	};
};
