import { superValidate, message } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { deductionSchema as schema } from './deductions';

import { db } from '$lib/server/db';
import { deductions, payrollEntries, reports } from '$lib/server/db/schema';
import { eq, sql } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';
import { fail } from 'sveltekit-superforms';
import { setFlash } from 'sveltekit-flash-message/server';

export const load: PageServerLoad = async () => {
	const form = await superValidate(zod4(schema));

	return {
		form
	};
};

export const actions: Actions = {
	addDeduction: async ({ request, cookies, params, locals }) => {
		const { id } = params;
		const form = await superValidate(request, zod4(schema));

		if (!form.valid) {
			// Stay on the same page and set a flash message
			setFlash({ type: 'error', message: 'Please check your form data.' }, cookies);

			return fail(400, { form });
		}

		const { type, description, deductionDate, amount } = form.data;

		try {
			await db.insert(deductions).values({
				staffId: Number(id),
				amount,
				type,
				description,
				deductionDate,
				createdBy: locals.user?.id
			});

			// Stay on the same page and set a flash message
			setFlash({ type: 'success', message: 'Deduction Successuflly Added' }, cookies);
			return message(form, { type: 'success', text: 'Deduction Successuflly Added' });
		} catch (err) {
			setFlash(
				{ type: 'error', message: 'An Error occured while adding Deduction' + err.message },
				cookies
			);

			return message(form, {
				type: 'error',
				text: 'An Error occured while adding Deduction' + err.message
			});
		}
	}
};
