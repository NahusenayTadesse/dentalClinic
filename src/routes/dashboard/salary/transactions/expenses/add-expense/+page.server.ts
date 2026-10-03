import { superValidate, message } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { fail } from '@sveltejs/kit';
import { notDeleted } from '$lib/server/softDelete';
import { insertExpenseSchema as schema } from './expenseSchema';
import { db } from '$lib/server/db';
import { expenses, expensesType, transactions } from '$lib/server/db/schema/';
import { asRequested } from '$lib/server/approvals';
import type { Actions } from './$types';
import { setFlash } from 'sveltekit-flash-message/server';

/*
 * Unannotated on purpose: `: PageServerLoad` widens the return to the generic signature and
 * `PageData` loses the keys the page reads.
 */
export const load = async () => {
	const form = await superValidate(zod4(schema));
	const categories = await db
		.select({
			value: expensesType.id,
			name: expensesType.name,
			description: expensesType.description
		})
		.from(expensesType)
		.where(notDeleted(expensesType));

	return {
		form,
		categories,
		paymentMethods: await paymentMethodList()
	};
};

import { saveUploadedFile } from '$lib/server/upload';
import { paymentMethods as paymentMethodList } from '$lib/server/fastData';

export const actions: Actions = {
	addExpense: async ({ request, cookies, locals }) => {
		const form = await superValidate(request, zod4(schema));

		console.log(form);

		if (!form.valid) {
			// Stay on the same page and set a flash message
			setFlash({ type: 'error', message: 'Please check your form data.' }, cookies);
			return fail(400, { form });
		}

		const { expenseDate, total, type, description, paymentMethod, reciept } = form.data;

		try {
			const imageName = await saveUploadedFile(reciept);

			await db.transaction(async (tx) => {
				// `tx`, not `db`: these were running outside the surrounding transaction,
				// so a failure in the bank update left the expense and its transaction
				// behind with no matching money movement.
				const [transaction] = await tx
					.insert(transactions)
					.values({
						amount: -Math.abs(total),
						direction: 'out',
						paymentMethodId: paymentMethod,
						recieptLink: imageName,
						description,
						paymentStatus: 'paid',
						createdBy: locals.user?.id
					})
					.$returningId();

				await tx.insert(expenses).values({
					...asRequested(locals?.user?.id),
					// `decimal`, so Drizzle wants the string form — see CLAUDE.md §9 on money.
					total: String(total),
					transactionId: transaction.id,
					type,
					description,
					// The form posts a `YYYY-MM-DD` string; the column is a `date`.
					expenseDate: new Date(expenseDate),
					createdBy: locals.user?.id
				});
			});

			return message(form, { type: 'success', text: 'Expense Added Successfully' });
		} catch (err) {
			const reason = err instanceof Error ? err.message : 'Unknown error';
			setFlash({ type: 'error', message: `Unexpected Error: ${reason}` }, cookies);
			return message(form, { type: 'error', text: `Unexpected Error: ${reason}` }, { status: 500 });
		}
	}
};
