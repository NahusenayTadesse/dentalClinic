import { message, setError, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { eq } from 'drizzle-orm';

import { notDeleted } from '$lib/server/softDelete';
import { db } from '$lib/server/db';
import { paymentMethods, user } from '$lib/server/db/schema/';
import { lookupDeleteAction } from '$lib/server/lookupDelete';
import { isDuplicateKey } from '@nahu/admin-kit/server/dbErrors.js';
import { paymentMethod as schema, editPaymentMethod as editSchema } from './schema';
import type { Actions, PageServerLoad } from './$types';

/**
 * The ways a patient can pay, and what kind of money each is.
 *
 * Hand-written rather than a `LookupConfig` on purpose (CLAUDE.md §2): the list shows who created
 * each method through an attribution join that needs both the user's id and name and must not
 * filter deleted users (§9). `kind` is the field that matters to billing — a method of kind `cash`
 * needs the drawer open to be taken (`server/payments.ts`).
 */
export const load: PageServerLoad = async () => {
	const [form, editForm, allPaymentMethods] = await Promise.all([
		superValidate(zod4(schema)),
		superValidate(zod4(editSchema)),
		db
			.select({
				id: paymentMethods.id,
				name: paymentMethods.name,
				kind: paymentMethods.kind,
				createdBy: user.name,
				createdById: paymentMethods.createdBy
			})
			.from(paymentMethods)
			// Attribution: not filtered on deletion — a deleted user still created it (§9).
			.leftJoin(user, eq(user.id, paymentMethods.createdBy))
			.where(notDeleted(paymentMethods))
	]);
	return { form, editForm, allPaymentMethods };
};

export const actions: Actions = {
	add: async ({ request, locals }) => {
		const form = await superValidate(request, zod4(schema));
		if (!form.valid)
			return message(form, { type: 'error', text: 'Please check the form.' }, { status: 400 });

		try {
			await db.insert(paymentMethods).values({
				name: form.data.name,
				kind: form.data.kind,
				createdBy: locals.user?.id
			});
			return message(form, { type: 'success', text: 'Payment method added.' });
		} catch (err: unknown) {
			if (isDuplicateKey(err)) return setError(form, 'name', 'That payment method already exists.');
			console.error('add payment method failed', err);
			return message(form, { type: 'error', text: 'It could not be added.' }, { status: 500 });
		}
	},

	edit: async ({ request, locals }) => {
		const form = await superValidate(request, zod4(editSchema));
		if (!form.valid)
			return message(form, { type: 'error', text: 'Please check the form.' }, { status: 400 });

		try {
			await db
				.update(paymentMethods)
				.set({ name: form.data.name, kind: form.data.kind, updatedBy: locals.user?.id })
				.where(eq(paymentMethods.id, form.data.id));
			return message(form, { type: 'success', text: 'Payment method updated.' });
		} catch (err: unknown) {
			if (isDuplicateKey(err)) return setError(form, 'name', 'That payment method already exists.');
			console.error('edit payment method failed', err);
			return message(form, { type: 'error', text: 'It could not be saved.' }, { status: 500 });
		}
	},

	/** Soft delete, super admin only. See `lookupDeleteAction`. */
	delete: lookupDeleteAction(paymentMethods, 'payment method')
};
