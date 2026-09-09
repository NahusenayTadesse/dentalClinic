import { superValidate, message, fail } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { and, asc, eq } from 'drizzle-orm';
import { notDeleted } from '$lib/server/softDelete';

import { add, edit } from './schema';
import { db } from '$lib/server/db';
import { annualLeaveEntitlement } from '$lib/server/db/schema/';
import { lookupDeleteAction } from '$lib/server/lookupDelete';
import type { Actions } from './$types';
import type { PageServerLoad } from './$types.js';

export const load: PageServerLoad = async () => {
	const form = await superValidate(zod4(add));
	const editForm = await superValidate(zod4(edit));

	const allData = await db
		.select({
			id: annualLeaveEntitlement.id,
			fromYears: annualLeaveEntitlement.fromYears,
			toYears: annualLeaveEntitlement.toYears,
			days: annualLeaveEntitlement.days,
			description: annualLeaveEntitlement.description,
			status: annualLeaveEntitlement.status
		})
		.from(annualLeaveEntitlement)
		.where(notDeleted(annualLeaveEntitlement))
		.orderBy(asc(annualLeaveEntitlement.fromYears));

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

		const { fromYears, toYears, days, description, status } = form.data;

		try {
			await db.insert(annualLeaveEntitlement).values({
				fromYears,
				toYears: toYears ?? null,
				days,
				description,
				status
			});

			return message(form, { type: 'success', text: 'Entitlement Successfully Added' });
		} catch (err: any) {
			return message(form, { type: 'error', text: err.message });
		}
	},
	edit: async ({ request }) => {
		const form = await superValidate(request, zod4(edit));

		if (!form.valid) {
			return fail(400, { form });
		}

		const { id, fromYears, toYears, days, description, status } = form.data;

		try {
			await db
				.update(annualLeaveEntitlement)
				.set({ fromYears, toYears: toYears ?? null, days, description, status })
				.where(eq(annualLeaveEntitlement.id, id));

			return message(form, { type: 'success', text: 'Entitlement Successfully Updated' });
		} catch (err: any) {
			return message(form, { type: 'error', text: err.message });
		}
	},

	/** Soft delete, super admin only. See `lookupDeleteAction`. */
	delete: lookupDeleteAction(annualLeaveEntitlement, 'entitlement')
};
