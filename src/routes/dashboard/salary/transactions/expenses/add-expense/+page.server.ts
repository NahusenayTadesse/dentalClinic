import { superValidate, message } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { fail } from '@sveltejs/kit';
import { sql, eq, and } from 'drizzle-orm';
import { notDeleted } from '$lib/server/softDelete';
import { overdraftCheck, overdraftMessage, postToBank } from '$lib/server/bankLedger';
import { insertExpenseSchema as schema } from './expenseSchema';
import { db } from '$lib/server/db';
import {
	expenses,
	expensesType,
	transactions,
	paymentMethods,
	reports,
	bankAmount,
	bankInsertHistory
} from '$lib/server/db/schema/';
import { asRequested } from '$lib/server/approvals';
import type { Actions } from './$types';
import type { PageServerLoad } from './$types.js';
import { setFlash } from 'sveltekit-flash-message/server';

export const load: PageServerLoad = async () => {
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
		banks: await banks()
	};
};

import { saveUploadedFile } from '$lib/server/upload';
import { banks } from '$lib/server/fastData';

export const actions: Actions = {
	addExpense: async ({ request, cookies, locals }) => {
		const form = await superValidate(request, zod4(schema));

		console.log(form);

		if (!form.valid) {
			// Stay on the same page and set a flash message
			setFlash({ type: 'error', message: 'Please check your form data.' }, cookies);
			return fail(400, { form });
		}

		const { expenseDate, total, type, description, bank, reciept, acknowledgeOverdraft } =
			form.data;

		// Advisory, not a block: these balances are a bookkeeping aid rather than a
		// live bank feed, so the app cannot actually know the money is missing. Warn,
		// take the acknowledgement, then record it.
		const check = await overdraftCheck(bank, -Math.abs(total));
		if (check?.overdraws && !acknowledgeOverdraft) {
			return message(form, { type: 'error', text: overdraftMessage(check) }, { status: 400 });
		}

		try {
			const imageName = await saveUploadedFile(reciept);

			await db.transaction(async (tx) => {
				const [paymentMethod] = await tx
					.select({
						id: bankAmount.paymentMethodId
					})
					.from(bankAmount)
					.where(eq(bankAmount.id, bank))
					.limit(1);

				// `tx`, not `db`: these were running outside the surrounding transaction,
				// so a failure in the bank update left the expense and its transaction
				// behind with no matching money movement.
				const [transaction] = await tx
					.insert(transactions)
					.values({
						amount: String(-Math.abs(total)),
						paymentMethodId: paymentMethod.id,
						recieptLink: imageName,
						description,
						paymentStatus: 'paid',
						createdBy: locals.user?.id
					})
					.$returningId();

				await tx.insert(expenses).values({
					...asRequested(locals?.user?.id),
					total,
					transactionId: transaction.id,
					type,
					description,
					expenseDate,
					createdBy: locals.user?.id
				});

				await postToBank(tx, {
					bankAmountId: bank,
					transactionId: transaction.id,
					amount: -Math.abs(total),
					reason: 'Expense',
					userId: locals?.user?.id
				});
			});

			return message(form, { type: 'success', text: 'Expense Added Successfully' });
		} catch (err) {
			setFlash({ type: 'error', message: `Unexpected Error: ${err.message}` }, cookies);
			return message(
				form,
				{ type: 'error', text: `Unexpected Error: ${err.message}` },
				{ status: 500 }
			);
		}
	}
};
