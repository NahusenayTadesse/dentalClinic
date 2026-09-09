import { setError, superValidate, message, fail } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { and, eq } from 'drizzle-orm';
import { notDeleted } from '$lib/server/softDelete';

import { paymentMethod as schema, editPaymentMethod as editSchema } from './schema';
import { db } from '$lib/server/db';
import { paymentMethods, user } from '$lib/server/db/schema/';
import { lookupDeleteAction } from '$lib/server/lookupDelete';
import type { Actions } from './$types';
import type { PageServerLoad } from './$types.js';

export const load: PageServerLoad = async () => {
	const form = await superValidate(zod4(schema));
	const editForm = await superValidate(zod4(editSchema));

	const allPaymentMethods = await db
		.select({
			id: paymentMethods.id,
			name: paymentMethods.name,
			createdBy: user.name,
			createdById: paymentMethods.createdBy
		})
		.from(paymentMethods)
		.leftJoin(user, eq(user.id, paymentMethods.createdBy))
		.where(notDeleted(paymentMethods));

	return {
		form,
		editForm,
		allPaymentMethods
	};
};

export const actions: Actions = {
	add: async ({ request, locals }) => {
		const form = await superValidate(request, zod4(schema));

		if (!form.valid) {
			return message(form, { type: 'error', text: 'Please check the form for Errors' });
		}

		const { name } = form.data;

		try {
			await db.insert(paymentMethods).values({
				name,
				createdBy: locals.user?.id
			});

			return message(form, { type: 'success', text: 'Payment Method Successfully Created' });
		} catch (err: any) {
			if (err.code === 'ER_DUP_ENTRY') setError(form, 'name', 'Payment Method already exists.');
			return message(form, {
				type: 'error',
				text:
					err.code === 'ER_DUP_ENTRY'
						? 'Payment Method is already taken. Please choose another one.'
						: err.message
			});
		}
	},
	edit: async ({ request, locals }) => {
		const form = await superValidate(request, zod4(editSchema));

		if (!form.valid) {
			return fail(400, { form });
		}

		const { id, name } = form.data;

		try {
			await db
				.update(paymentMethods)
				.set({ name, updatedBy: locals?.user?.id })
				.where(eq(paymentMethods.id, id));
			return message(form, { type: 'success', text: 'Payment Method Successfully Updated' });
		} catch (err: any) {
			if (err.code === 'ER_DUP_ENTRY')
				return setError(form, 'name', 'Payment Method already exists.');
			return message(form, {
				type: 'error',
				text:
					err.code === 'ER_DUP_ENTRY'
						? 'Payment Method is already taken. Please choose another one.'
						: err.message
			});
		}
	},

	/** Soft delete, super admin only. See `lookupDeleteAction`. */
	delete: lookupDeleteAction(paymentMethods, 'payment method')
};
