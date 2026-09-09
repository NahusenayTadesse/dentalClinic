import { setError, superValidate, message, fail } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { eq } from 'drizzle-orm';

import { add } from './schema';
import { db } from '$lib/server/db';
import { vatAndWithHold as taxType } from '$lib/server/db/schema/';
import type { Actions } from './$types';
import type { PageServerLoad } from './$types.js';

export const load: PageServerLoad = async () => {
	const allData = await db
		.select()
		.from(taxType)
		.then((rows) => rows[0]);
	const form = await superValidate(allData, zod4(add));
	return {
		form,

		allData
	};
};

export const actions: Actions = {
	add: async ({ request }) => {
		const form = await superValidate(request, zod4(add));

		if (!form.valid) {
			return message(form, { type: 'error', text: 'Please check the form for Errors' });
		}

		const { vat, withHold } = form.data;

		try {
			await db.transaction(async (tx) => {
				await tx.delete(taxType);
				await tx.insert(taxType).values({
					vat,
					withHold
				});
			});

			return message(form, { type: 'success', text: 'Vat and Withhold Successfully Changed' });
		} catch (err: any) {
			console.error(err);
			return message(form, {
				type: 'error',
				text: 'Unexpected error occurred: ' + err.message
			});
		}
	}
};
