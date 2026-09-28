import { superValidate, message } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';

import { supplyItemSchema as schema } from './schema';
import { db } from '$lib/server/db';
import { supplies } from '$lib/server/db/schema/';
import type { Actions } from './$types';
import type { PageServerLoad } from './$types.js';
import { supplyCategories } from '$lib/server/fastData';

export const load: PageServerLoad = async () => {
	const form = await superValidate(zod4(schema));
	const typeList = await supplyCategories();

	return {
		form,
		typeList
	};
};

export const actions: Actions = {
	add: async ({ request, locals }) => {
		const form = await superValidate(request, zod4(schema));

		if (!form.valid) {
			// Stay on the same page and set a flash message
			return message(form, { type: 'error', text: 'Please check your form data.' });
		}

		const {
			name,
			description,
			supplyType,
			unitOfMeasurement,
			otherUnitOfMeasurement,
			reorderLevel,
			returnable,
			tracksExpiry
		} = form.data;

		try {
			await db.insert(supplies).values({
				name,
				description,
				supplyTypeId: Number(supplyType),
				unitOfMeasure: unitOfMeasurement === 'other' ? otherUnitOfMeasurement : unitOfMeasurement,
				reorderLevel,
				returnable,
				tracksExpiry,
				createdBy: locals?.user?.id
			});

			// Stay on the same page and set a flash message
			return message(form, { type: 'success', text: 'New Supply Successfully Added' });
		} catch (err: unknown) {
			console.error('add supply failed', err);
			return message(form, { type: 'error', text: 'The item could not be added.' });
		}
	}
};
