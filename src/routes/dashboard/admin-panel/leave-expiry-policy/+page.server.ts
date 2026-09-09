import { superValidate, message, fail } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { and, desc, eq, ne } from 'drizzle-orm';
import { notDeleted } from '$lib/server/softDelete';

import { add, edit } from './schema';
import { db } from '$lib/server/db';
import { leaveExpiryPolicy } from '$lib/server/db/schema/';
import { lookupDeleteAction } from '$lib/server/lookupDelete';
import type { Actions } from './$types';
import type { PageServerLoad } from './$types.js';

export const load: PageServerLoad = async () => {
	const form = await superValidate(zod4(add));
	const editForm = await superValidate(zod4(edit));

	const allData = await db
		.select({
			id: leaveExpiryPolicy.id,
			name: leaveExpiryPolicy.name,
			expiryYears: leaveExpiryPolicy.expiryYears,
			description: leaveExpiryPolicy.description,
			status: leaveExpiryPolicy.status
		})
		.from(leaveExpiryPolicy)
		.where(notDeleted(leaveExpiryPolicy))
		.orderBy(desc(leaveExpiryPolicy.id));

	return {
		form,
		editForm,
		allData
	};
};

export const actions: Actions = {
	add: async ({ request }) => {
		const form = await superValidate(request, zod4(add));

		if (!form.valid) {
			return message(form, { type: 'error', text: 'Please check the form for Errors' });
		}

		const { name, expiryYears, description, status } = form.data;

		try {
			await db.transaction(async (tx) => {
				const [inserted] = await tx
					.insert(leaveExpiryPolicy)
					.values({ name, expiryYears, description, status })
					.$returningId();

				// Only one policy governs expiry at a time, so activating this one retires the rest.
				if (status) {
					await tx
						.update(leaveExpiryPolicy)
						.set({ status: false })
						.where(ne(leaveExpiryPolicy.id, inserted.id));
				}
			});

			return message(form, { type: 'success', text: 'Expiry Policy Successfully Added' });
		} catch (err: any) {
			return message(form, { type: 'error', text: err.message });
		}
	},
	edit: async ({ request }) => {
		const form = await superValidate(request, zod4(edit));

		if (!form.valid) {
			return fail(400, { form });
		}

		const { id, name, expiryYears, description, status } = form.data;

		try {
			await db.transaction(async (tx) => {
				await tx
					.update(leaveExpiryPolicy)
					.set({ name, expiryYears, description, status })
					.where(eq(leaveExpiryPolicy.id, id));

				if (status) {
					await tx
						.update(leaveExpiryPolicy)
						.set({ status: false })
						.where(ne(leaveExpiryPolicy.id, id));
				}
			});

			return message(form, { type: 'success', text: 'Expiry Policy Successfully Updated' });
		} catch (err: any) {
			return message(form, { type: 'error', text: err.message });
		}
	},

	/** Soft delete, super admin only. See `lookupDeleteAction`. */
	delete: lookupDeleteAction(leaveExpiryPolicy, 'expiry policy')
};
