import { superValidate, message } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { bonusSchema as schema } from './schema';

import { db } from '$lib/server/db';
import { bonuses } from '$lib/server/db/schema';
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
	addBonus: async ({ request, cookies, params, locals }) => {
		const { id } = params;
		const form = await superValidate(request, zod4(schema));

		if (!form.valid) {
			// Stay on the same page and set a flash message
			setFlash({ type: 'error', message: 'Please check your form data.' }, cookies);

			return fail(400, { form });
		}

		const { description, bonusDate, amount } = form.data;

		try {
			await db.insert(bonuses).values({
				staffId: Number(id),
				amount,

				description,
				bonusDate,
				createdBy: locals.user?.id
			});

			// Stay on the same page and set a flash message
			setFlash({ type: 'success', message: 'Bonus Successuflly Added' }, cookies);
			return message(form, { type: 'success', text: 'Bonus Successfully Added' });
		} catch (err) {
			setFlash(
				{ type: 'error', message: 'An Error occured while adding Bonus' + err.message },
				cookies
			);
			return message(form, {
				type: 'error',
				text: 'An Error occured while adding Bonus' + err.message
			});
		}
	}
};
