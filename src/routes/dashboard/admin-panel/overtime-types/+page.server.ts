import { setError, superValidate, message, fail } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { and, eq } from 'drizzle-orm';
import { notDeleted } from '$lib/server/softDelete';

import { add, edit } from './schema';
import { db } from '$lib/server/db';
import { overTimeType as taxType } from '$lib/server/db/schema/';
import { lookupDeleteAction } from '$lib/server/lookupDelete';
import type { Actions } from './$types';
import type { PageServerLoad } from './$types.js';

export const load: PageServerLoad = async () => {
	const form = await superValidate(zod4(add));
	const editForm = await superValidate(zod4(edit));

	const allData = await db
		.select({
			id: taxType.id,
			name: taxType.name,
			rate: taxType.rate,
			maxhours: taxType.maxhours,
			status: taxType.isActive
		})
		.from(taxType)
		.where(notDeleted(taxType));

	return {
		form,
		editForm,
		allData
	};
};

export const actions: Actions = {
	add: async ({ request, locals }) => {
		const form = await superValidate(request, zod4(add));

		if (!form.valid) {
			return message(form, { type: 'error', text: 'Please check the form for Errors' });
		}

		const { name, rate, status, maxhours } = form.data;

		try {
			await db.insert(taxType).values({
				name,

				rate,
				maxhours,
				isActive: status,
				createdBy: locals?.user?.id
			});

			return message(form, { type: 'success', text: 'Overtime Type Successfully Added' });
		} catch (err: any) {
			if (err.code === 'ER_DUP_ENTRY') setError(form, 'name', 'Overtime type already exists.');
			return message(form, {
				type: 'error',
				text:
					err.code === 'ER_DUP_ENTRY'
						? 'Overtime type is already exists. Please choose another one.'
						: err.message
			});
		}
	},
	edit: async ({ request, locals }) => {
		const form = await superValidate(request, zod4(edit));
		if (!form.valid) {
			return fail(400, { form });
		}

		const { id, name, rate, status, maxhours } = form.data;

		try {
			await db
				.update(taxType)
				.set({
					name,
					rate: String(rate),
					maxhours,
					isActive: status,
					updatedBy: locals?.user?.id
				})
				.where(eq(taxType.id, id));
			return message(form, { type: 'success', text: 'Tax type Successfully Updated' });
		} catch (err: any) {
			if (err.code === 'ER_DUP_ENTRY') return;
			setError(form, 'name', 'Overtime Type name already exists.');
			return message(form, {
				type: 'error',
				text:
					err.code === 'ER_DUP_ENTRY'
						? 'Overtime type name is already taken. Please choose another one.'
						: err.message
			});
		}
	},

	/** Soft delete, super admin only. See `lookupDeleteAction`. */
	delete: lookupDeleteAction(taxType, 'overtime type')
};
