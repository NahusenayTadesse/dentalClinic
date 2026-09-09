import { setError, superValidate, message, fail } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { and, eq } from 'drizzle-orm';
import { notDeleted } from '$lib/server/softDelete';

import { add, edit } from './schema';
import { db } from '$lib/server/db';
import { position, department } from '$lib/server/db/schema/';
import { lookupDeleteAction } from '$lib/server/lookupDelete';
import type { Actions } from './$types';
import type { PageServerLoad } from './$types.js';
import { departments } from '$lib/server/fastData';

export const load: PageServerLoad = async () => {
	const form = await superValidate(zod4(add));
	const editForm = await superValidate(zod4(edit));

	const allData = await db
		.select({
			id: position.id,
			name: position.name,
			department: department.name,
			departmentId: position.departmentId,
			status: position.status
		})
		.from(position)
		.leftJoin(department, and(eq(department.id, position.departmentId), notDeleted(department)))
		.where(notDeleted(position));

	const departmentList = await departments();

	return {
		form,
		editForm,
		allData,
		departmentList
	};
};

export const actions: Actions = {
	add: async ({ request }) => {
		const form = await superValidate(request, zod4(add));

		if (!form.valid) {
			return message(form, { type: 'error', text: 'Please check the form for Errors' });
		}

		const { name, departmentId, status } = form.data;

		try {
			await db.insert(position).values({
				name,
				departmentId,
				status
			});

			return message(form, { type: 'success', text: 'Position Successfully Added' });
		} catch (err: any) {
			if (err.code === 'ER_DUP_ENTRY') setError(form, 'name', 'Position already exists.');
			return message(form, {
				type: 'error',
				text:
					err.code === 'ER_DUP_ENTRY'
						? 'Position is already exists. Please choose another one.'
						: err.message
			});
		}
	},
	edit: async ({ request }) => {
		const form = await superValidate(request, zod4(edit));

		if (!form.valid) {
			return fail(400, { form });
		}

		const { id, name, departmentId, status } = form.data;

		try {
			await db.update(position).set({ name, departmentId, status }).where(eq(position.id, id));
			return message(form, { type: 'success', text: 'Position Successfully Updated' });
		} catch (err: any) {
			if (err.code === 'ER_DUP_ENTRY') return setError(form, 'name', 'Position already exists.');
			return message(form, {
				type: 'error',
				text:
					err.code === 'ER_DUP_ENTRY'
						? 'Position is already taken. Please choose another one.'
						: err.message
			});
		}
	},

	/** Soft delete, super admin only. See `lookupDeleteAction`. */
	delete: lookupDeleteAction(position, 'position')
};
