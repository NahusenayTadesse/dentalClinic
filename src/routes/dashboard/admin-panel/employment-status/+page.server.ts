import { setError, superValidate, message, fail } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { and, eq } from 'drizzle-orm';
import { notDeleted } from '$lib/server/softDelete';

import { add, edit } from './schema';
import { db } from '$lib/server/db';
import { employmentStatuses as department } from '$lib/server/db/schema/';
import { lookupDeleteAction } from '$lib/server/lookupDelete';
import type { Actions } from './$types';
import type { PageServerLoad } from './$types.js';

export const load: PageServerLoad = async () => {
	const form = await superValidate(zod4(add));
	const editForm = await superValidate(zod4(edit));

	const allData = await db
		.select({
			id: department.id,
			name: department.name,
			removeFromLists: department.removeFromLists,
			terminationStatus: department.terminationStatus,
			description: department.description,
			status: department.status
		})
		.from(department)
		.where(notDeleted(department));

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

		const { name, removeFromLists, terminationStatus, description, status } = form.data;

		try {
			await db.insert(department).values({
				name,
				removeFromLists,
				terminationStatus: terminationStatus || null,
				description,
				status: status
			});

			return message(form, { type: 'success', text: 'Employment Status Successfully Added' });
		} catch (err: any) {
			if (err.code === 'ER_DUP_ENTRY') setError(form, 'name', 'Employment Status already exists.');
			return message(form, {
				type: 'error',
				text:
					err.code === 'ER_DUP_ENTRY'
						? 'Employment is already exists. Please choose another one.'
						: err.message
			});
		}
	},
	edit: async ({ request }) => {
		const form = await superValidate(request, zod4(edit));
		if (!form.valid) {
			return fail(400, { form });
		}

		const { id, name, description, removeFromLists, terminationStatus, status } = form.data;

		try {
			await db
				.update(department)
				.set({
					name,
					removeFromLists,
					terminationStatus: terminationStatus || null,
					description,
					status
				})
				.where(eq(department.id, Number(id)));
			return message(form, { type: 'success', text: 'Employment Status Successfully Updated' });
		} catch (err: any) {
			if (err.code === 'ER_DUP_ENTRY') return;
			setError(form, 'name', 'Employment Status name already exists.');
			return message(form, {
				type: 'error',
				text:
					err.code === 'ER_DUP_ENTRY'
						? 'Employment Status name is already taken. Please choose another one.'
						: err.message
			});
		}
	},

	/** Soft delete, super admin only. See `lookupDeleteAction`. */
	delete: lookupDeleteAction(department, 'employment status')
};
