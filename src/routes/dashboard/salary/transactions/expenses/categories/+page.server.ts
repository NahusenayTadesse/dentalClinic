import { setError, superValidate, message, fail } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { eq } from 'drizzle-orm';
import { notDeleted, softDeleteLookup } from '$lib/server/softDelete';
import { requireSuperAdmin } from '$lib/server/permissions';
import { add, edit, deleteService } from './schema';
import { db } from '$lib/server/db';
import { expensesType as paymentMethods } from '$lib/server/db/schema';
import type { Actions } from './$types';
import type { PageServerLoad } from './$types.js';

export const load: PageServerLoad = async () => {
	const form = await superValidate(zod4(add));
	const editForm = await superValidate(zod4(edit));
	const deleteForm = await superValidate(zod4(deleteService));

	const allData = await db
		.select({
			id: paymentMethods.id,
			name: paymentMethods.name,
			description: paymentMethods.description
		})
		.from(paymentMethods)
		.where(notDeleted(paymentMethods));

	return {
		form,
		editForm,
		deleteForm,
		allData
	};
};

export const actions: Actions = {
	add: async ({ request }) => {
		const form = await superValidate(request, zod4(add));

		if (!form.valid) {
			return message(form, { type: 'error', text: 'Please check the form for Errors' });
		}

		const { name, description } = form.data;

		try {
			await db.insert(paymentMethods).values({
				name,
				description
			});

			return message(form, { type: 'success', text: 'Category Successfully Created' });
		} catch (err: any) {
			if (err.code === 'ER_DUP_ENTRY') setError(form, 'name', 'Category already exists.');
			return message(form, {
				type: 'error',
				text:
					err.code === 'ER_DUP_ENTRY'
						? 'Service is already taken. Please choose another one.'
						: err.message
			});
		}
	},
	edit: async ({ request }) => {
		const form = await superValidate(request, zod4(edit));

		if (!form.valid) {
			return fail(400, { form });
		}

		const { id, name, description } = form.data;

		try {
			await db.update(paymentMethods).set({ name, description }).where(eq(paymentMethods.id, id));
			return message(form, { type: 'success', text: 'Expenses Type Successfully Updated' });
		} catch (err: any) {
			if (err.code === 'ER_DUP_ENTRY') return setError(form, 'name', 'Category already exists.');
			return message(form, {
				type: 'error',
				text:
					err.code === 'ER_DUP_ENTRY'
						? 'Expenses Type   is already taken. Please choose another one.'
						: err.message
			});
		}
	},
	delete: async ({ request, locals }) => {
		// Outside the try on purpose: `requireSuperAdmin` throws a 403, and a
		// catch below would swallow it into a plain error message.
		requireSuperAdmin(locals);

		const form = await superValidate(request, zod4(deleteService));

		if (!form.valid) {
			return fail(400, { form });
		}

		const { id } = form.data;

		try {
			const deleted = await db.transaction(async (tx) =>
				softDeleteLookup(tx, paymentMethods, id, locals.user?.id)
			);

			if (!deleted) {
				return message(form, { type: 'error', text: 'That expense type was not found' });
			}

			return message(form, { type: 'success', text: 'Expenses Type Successfully Deleted' });
		} catch (err: any) {
			return message(
				form,
				{
					type: 'error',
					text: 'Error while deleting category.'
				},
				{ status: 500 }
			);
		}
	}
};
