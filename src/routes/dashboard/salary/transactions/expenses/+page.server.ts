import { db } from '$lib/server/db';
import { paymentMethods, transactions, expenses, expensesType, user } from '$lib/server/db/schema';
import { isApproved } from '$lib/server/approvals';
import { and, desc, eq, count } from 'drizzle-orm';
import { notDeleted, softDeleteExpense } from '$lib/server/softDelete';
import { requireSuperAdmin } from '$lib/server/permissions';
import { fail } from '@sveltejs/kit';
import { setFlash } from 'sveltekit-flash-message/server';

import { parseTableQuery, buildWhere, pagination, currentQuery } from '$lib/server/queryFilters';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const query = parseTableQuery(url, ['paymentMethodId', 'expenseTypeId', 'recievedById']);

	const whereClause = buildWhere(query, {
		// Only approved expenses belong in the main list.
		base: [notDeleted(expenses), isApproved(expenses)!],
		dateColumn: transactions.createdAt,
		filters: {
			paymentMethodId: (v) => eq(transactions.paymentMethodId, Number(v)),
			expenseTypeId: (v) => eq(expenses.type, Number(v)),
			// varchar — no Number() cast
			recievedById: (v) => eq(transactions.createdBy, v)
		}
	});

	// --- Filter option lists ---
	const [paymentMethodOptions, expenseTypeOptions, userOptions] = await Promise.all([
		db
			.select({ id: paymentMethods.id, name: paymentMethods.name })
			.from(paymentMethods)
			.where(notDeleted(paymentMethods)),
		db
			.select({ id: expensesType.id, name: expensesType.name })
			.from(expensesType)
			.where(notDeleted(expensesType)),
		db.select({ id: user.id, name: user.name }).from(user)
	]);

	// --- Total count (same joins the WHERE clause needs) ---
	const [{ total }] = await db
		.select({ total: count() })
		.from(expenses)
		.leftJoin(
			transactions,
			and(eq(expenses.transactionId, transactions.id), notDeleted(transactions))
		)
		.where(whereClause);

	// --- Main query ---
	const allTransactions = await db
		.select({
			id: transactions.id,
			// The delete action needs the expense row, not the transaction row.
			expenseId: expenses.id,
			date: transactions.createdAt,
			expenseType: expensesType.name,
			expenseTypeId: expensesType.id,
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
		.where(whereClause)
		.groupBy(
			transactions.id,
			transactions.createdAt,
			expenses.total,
			expensesType.name,
			expensesType.id,
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
			expenseTypes: expenseTypeOptions,
			users: userOptions
		},
		currentQuery: currentQuery(query)
	};
};

export const actions: Actions = {
	/**
	 * Soft delete of one expense. Super admin only — `requireSuperAdmin` throws
	 * 403 rather than failing quietly, because the hidden button is UX, not
	 * access control.
	 *
	 * The helper also deletes the transaction behind the expense, so the amount
	 * stops showing on the transactions listing too.
	 */
	delete: async ({ request, locals, cookies }) => {
		requireSuperAdmin(locals);

		const data = await request.formData();
		const expenseId = Number(data.get('id'));

		if (!expenseId) {
			setFlash({ type: 'error', message: 'No expense was selected.' }, cookies);
			return fail(400);
		}

		try {
			const deleted = await db.transaction(async (tx) =>
				softDeleteExpense(tx, expenseId, locals.user?.id)
			);

			if (!deleted) {
				setFlash({ type: 'error', message: 'That expense was not found.' }, cookies);
				return fail(404);
			}
		} catch (err) {
			console.error('Error deleting expense:', err);
			setFlash(
				{
					type: 'error',
					message: `Could not delete expense: ${err instanceof Error ? err.message : 'Unknown error'}`
				},
				cookies
			);
			return fail(500);
		}

		setFlash({ type: 'success', message: 'Expense and its transaction deleted.' }, cookies);
		return { success: true };
	}
};
