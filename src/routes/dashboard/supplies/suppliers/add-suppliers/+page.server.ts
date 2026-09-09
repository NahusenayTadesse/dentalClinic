import { setError, superValidate, message, fail } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { eq } from 'drizzle-orm';

import { add, edit } from '../schema';
import { db } from '$lib/server/db';
import { supplySuppliers, supplies, subcity, address } from '$lib/server/db/schema/';
import type { Actions } from './$types';
import type { PageServerLoad } from './$types.js';
import { subcities } from '$lib/server/fastData';
export const load: PageServerLoad = async () => {
	const form = await superValidate(zod4(add));

	const subcitiesList = await subcities();

	return {
		form,
		subcitiesList
	};
};

export const actions: Actions = {
	add: async ({ request }) => {
		const form = await superValidate(request, zod4(add));

		if (!form.valid) {
			return message(form, { type: 'error', text: 'Please check the form for Errors' });
		}

		const {
			name,
			subcity,
			street,
			kebele,
			buildingNumber,
			floor,
			houseNumber,
			phone,
			description,
			status
		} = form.data;

		try {
			const [addressId] = await db
				.insert(address)
				.values({
					subcityId: subcity,
					street,
					kebele,
					buildingNumber,
					floor,
					houseNumber
				})
				.$returningId();

			await db.insert(supplySuppliers).values({
				name,
				phone,
				description,
				address: addressId.id,
				status: status
			});

			return message(form, { type: 'success', text: 'Supplier   Successfully Added' });
		} catch (err: any) {
			return message(form, {
				type: 'error',
				text: 'Error: ' + err?.message
			});
		}
	}
};
