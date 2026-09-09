import { setError, superValidate, message, fail } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { and, eq } from 'drizzle-orm';
import { notDeleted } from '$lib/server/softDelete';

import { add, edit } from './schema';
import { db } from '$lib/server/db';
import { leaveType } from '$lib/server/db/schema/';
import { lookupDeleteAction } from '$lib/server/lookupDelete';
import type { Actions } from './$types';
import type { PageServerLoad } from './$types.js';

export const load: PageServerLoad = async () => {
	const form = await superValidate(zod4(add));
	const editForm = await superValidate(zod4(edit));

	const allData = await db
		.select({
			id: leaveType.id,
			name: leaveType.name,
			maxDays: leaveType.maxDays,
			deductsBalance: leaveType.deductsBalance,
			description: leaveType.description,
			status: leaveType.status
		})
		.from(leaveType)
		.where(notDeleted(leaveType));

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

		const { name, maxDays, deductsBalance, description, status } = form.data;

		try {
			await db.insert(leaveType).values({
				name,
				maxDays,
				deductsBalance,
				description,
				status
			});

			return message(form, { type: 'success', text: 'Leave Type Successfully Added' });
		} catch (err: any) {
			if (err.code === 'ER_DUP_ENTRY') setError(form, 'name', 'Leave type already exists.');
			return message(form, {
				type: 'error',
				text:
					err.code === 'ER_DUP_ENTRY'
						? 'Leave type already exists. Please choose another name.'
						: err.message
			});
		}
	},
	edit: async ({ request }) => {
		const form = await superValidate(request, zod4(edit));

		if (!form.valid) {
			return fail(400, { form });
		}

		const { id, name, maxDays, deductsBalance, description, status } = form.data;

		try {
			await db
				.update(leaveType)
				.set({ name, maxDays, deductsBalance, description, status })
				.where(eq(leaveType.id, id));

			return message(form, { type: 'success', text: 'Leave Type Successfully Updated' });
		} catch (err: any) {
			if (err.code === 'ER_DUP_ENTRY') setError(form, 'name', 'Leave type name already exists.');
			return message(form, {
				type: 'error',
				text:
					err.code === 'ER_DUP_ENTRY'
						? 'Leave type name is already taken. Please choose another one.'
						: err.message
			});
		}
	},

	/** Soft delete, super admin only. See `lookupDeleteAction`. */
	delete: lookupDeleteAction(leaveType, 'leave type')
};
