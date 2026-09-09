import { setError, superValidate, message, fail } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { and, count, eq, sql } from 'drizzle-orm';
import { notDeleted } from '$lib/server/softDelete';

import { paymentMethod as schema, editPaymentMethod as editSchema } from './schema';
import { db } from '$lib/server/db';
import { bankAmount, paymentMethods, user, bankInsertHistory } from '$lib/server/db/schema/';
import { lookupDeleteAction } from '$lib/server/lookupDelete';
import type { Actions, PageServerLoad } from './$types';
import { paymentMethods as banks } from '$lib/server/fastData';

export const load: PageServerLoad = async () => {
	const form = await superValidate(zod4(schema));
	const editForm = await superValidate(zod4(editSchema));

	const allPaymentMethods = await db
		.select({
			id: bankAmount.id,
			bank: paymentMethods.id,
			bankName: paymentMethods.name,
			amount: bankAmount.amount,
			account: bankAmount.account,
			numberOfChanges: sql`COUNT(${bankInsertHistory.id})`,
			createdBy: user.name,
			createdById: bankAmount.createdBy
		})
		.from(bankAmount)
		.leftJoin(user, eq(user.id, bankAmount.createdBy))
		.leftJoin(paymentMethods, eq(paymentMethods.id, bankAmount.paymentMethodId))
		.leftJoin(bankInsertHistory, eq(bankInsertHistory.bankAmountId, bankAmount.id))
		.where(notDeleted(bankAmount))
		.groupBy(bankAmount.id, user.name, paymentMethods.id, paymentMethods.name);

	console.log(allPaymentMethods);

	return {
		form,
		editForm,
		banks: await banks(),
		allPaymentMethods
	};
};

export const actions: Actions = {
	add: async ({ request, locals }) => {
		const form = await superValidate(request, zod4(schema));
		console.log(form);
		if (!form.valid) {
			return message(
				form,
				{ type: 'error', text: 'Please check the form for Errors' },
				{ status: 400 }
			);
		}

		const { bank, amount, account } = form.data;

		try {
			await db.insert(bankAmount).values({
				paymentMethodId: bank,
				amount,
				account,
				createdBy: locals.user?.id
			});

			return message(form, { type: 'success', text: 'Bank Amount Successfully Created' });
		} catch (err: any) {
			console.log(err);
			if (err.code === 'ER_DUP_ENTRY') setError(form, 'bank', 'Bank already exists.');
			return message(
				form,
				{
					type: 'error',
					text:
						err.code === 'ER_DUP_ENTRY'
							? 'Bank already Exists. Please choose another one.'
							: err.message
				},
				{
					status: 500
				}
			);
		}
	},
	edit: async ({ request, locals }) => {
		const form = await superValidate(request, zod4(editSchema));

		if (!form.valid) {
			return message(
				form,
				{ type: 'error', text: 'Please check the form for Errors' },
				{ status: 400 }
			);
		}

		const { id, bank, account, amount } = form.data;

		try {
			await db
				.update(bankAmount)
				.set({
					paymentMethodId: bank,
					amount: String(amount),
					account,
					updatedBy: locals?.user?.id
				})
				.where(eq(bankAmount.id, Number(id)));
			return message(form, { type: 'success', text: 'Bank Successfully Updated' });
		} catch (err: any) {
			if (err.code === 'ER_DUP_ENTRY') setError(form, 'bank', 'Bank already exists.');
			return message(
				form,
				{
					type: 'error',
					text:
						err.code === 'ER_DUP_ENTRY'
							? 'Bank already Exists. Please choose another one.'
							: err.message
				},
				{ status: 500 }
			);
		}
	},

	/** Soft delete, super admin only. See `lookupDeleteAction`. */
	delete: lookupDeleteAction(bankAmount, 'bank amount')
};
