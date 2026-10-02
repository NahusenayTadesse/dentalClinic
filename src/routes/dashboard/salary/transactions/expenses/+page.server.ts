import { and, desc, eq, like, or, sql, type SQL } from 'drizzle-orm';
import type { SelectedFields } from 'drizzle-orm/mysql-core';

import { db } from '$lib/server/db';
import { joinedSelect } from '$lib/server/db/joinedSelect';
import { paymentMethods, transactions, expenses, expensesType, user } from '$lib/server/db/schema';
import { isApproved } from '$lib/server/approvals';
import { notDeleted, softDeleteExpense } from '$lib/server/softDelete';
import { requireSuperAdmin } from '$lib/server/permissions';
import { branchFilter } from '$lib/server/branchScope';
import { fail } from '@sveltejs/kit';
import { setFlash } from 'sveltekit-flash-message/server';
import {
	buildWhere,
	currentQuery,
	facetCounts,
	orderBy,
	pagination,
	parseTableQuery,
	type WhereSpec
} from '$lib/server/queryFilters';
import type { Actions, PageServerLoad } from './$types';

/**
 * The clinic's own spending, approved, over any period — filtered, faceted and totalled in SQL.
 * Like the transactions list, it stacked a paging filter bar with a menu that counted only the
 * page; one server-driven table now counts the whole result. Dated by the expense's own day, and
 * scoped to the branch its money left from (CLAUDE.md §15).
 */

const FILTERS = ['expenseTypeId', 'paymentMethodId', 'recievedById'] as const;
type Filter = (typeof FILTERS)[number];

const SORTABLE = {
	date: expenses.expenseDate,
	amount: expenses.total,
	expenseType: expensesType.name,
	paymentMethod: paymentMethods.name
};

export const load: PageServerLoad = async ({ url, locals }) => {
	const query = parseTableQuery(url, FILTERS, 25, Object.keys(SORTABLE));

	const spec: WhereSpec<Filter> = {
		// Only approved expenses belong in the main list; pending ones are in the approvals queue.
		base: [
			notDeleted(expenses),
			isApproved(expenses),
			branchFilter(transactions.branchId, locals.branch)
		],
		search: (term) =>
			or(like(expenses.description, `%${term}%`), like(expenses.payeeName, `%${term}%`)),
		dateColumn: expenses.expenseDate,
		filters: {
			expenseTypeId: (v) => eq(expenses.type, Number(v)),
			paymentMethodId: (v) => eq(transactions.paymentMethodId, Number(v)),
			// varchar — no Number() cast
			recievedById: (v) => eq(transactions.createdBy, v)
		}
	};
	const where = buildWhere(query, spec);

	const joined = <T extends SelectedFields>(fields: T) =>
		joinedSelect(fields, expenses)
			.leftJoin(
				transactions,
				and(eq(expenses.transactionId, transactions.id), notDeleted(transactions))
			)
			.leftJoin(expensesType, and(eq(expenses.type, expensesType.id), notDeleted(expensesType)))
			.leftJoin(paymentMethods, eq(transactions.paymentMethodId, paymentMethods.id))
			// Attribution, not filtered: a deleted user still recorded it (§9).
			.leftJoin(user, eq(transactions.createdBy, user.id));

	const [rows, [totals]] = await Promise.all([
		joined({
			id: transactions.id,
			// The delete action needs the expense row, not the transaction row.
			expenseId: expenses.id,
			date: sql<string>`${expenses.expenseDate}`,
			expenseType: expensesType.name,
			expenseTypeId: expensesType.id,
			description: expenses.description,
			payee: expenses.payeeName,
			amount: sql<string>`${expenses.total}`,
			paymentMethod: paymentMethods.name,
			recievedBy: user.name,
			recievedById: user.id,
			recieptLink: transactions.recieptLink
		})
			.where(where)
			.orderBy(...(orderBy(query, SORTABLE) ?? [desc(expenses.expenseDate)]), desc(expenses.id))
			.limit(query.limit)
			.offset(query.offset),
		joined({
			total: sql<number>`count(*)`,
			amount: sql<string>`coalesce(sum(${expenses.total}), 0)`
		}).where(where)
	]);

	/** A facet: every filter applied but its own (`facetCounts`). */
	const facet = async (
		value: SQL<string | number | null>,
		label: SQL<string | null>,
		except: Filter
	) =>
		joined({ value, label, count: sql<number>`count(*)` })
			.where(buildWhere(query, spec, { except }))
			.groupBy(value, label);

	const facets = await facetCounts({
		expenseType: () => facet(sql`${expensesType.id}`, sql`${expensesType.name}`, 'expenseTypeId'),
		paymentMethod: () =>
			facet(sql`${paymentMethods.id}`, sql`${paymentMethods.name}`, 'paymentMethodId'),
		recievedBy: () => facet(sql`${user.id}`, sql`${user.name}`, 'recievedById')
	});

	return {
		rows: rows.map((row) => ({ ...row, amount: Number(row.amount ?? 0) })),
		totals: { count: Number(totals?.total ?? 0), amount: Number(totals?.amount ?? 0) },
		facets,
		pagination: pagination(query, totals?.total ?? 0),
		currentQuery: currentQuery(query),
		isSuperAdmin: locals.isSuperAdmin === true
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
