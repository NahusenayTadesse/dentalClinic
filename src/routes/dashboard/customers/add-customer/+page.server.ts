import { superValidate, setError, message } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { eq, and } from 'drizzle-orm';
import { notDeleted } from '$lib/server/softDelete';
import { customerSchema as schema } from './schema';
import { db } from '$lib/server/db';
import { customers, address } from '$lib/server/db/schema/';
import { asRequested } from '$lib/server/approvals';
import { subcities } from '$lib/server/fastData';
import type { Actions } from './$types';
import type { PageServerLoad } from './$types.js';
import { setFlash, redirect } from 'sveltekit-flash-message/server';

export const load: PageServerLoad = async () => {
	const form = await superValidate(zod4(schema));

	const subcityList = await subcities();

	return {
		form,
		subcityList
	};
};

export const actions: Actions = {
	addCustomer: async ({ request, locals, cookies }) => {
		const form = await superValidate(request, zod4(schema));

		if (!form.valid) {
			// Stay on the same page and set a flash message
			return message(form, { type: 'error', text: 'Please check your form.' });
		}
		const {
			name,
			phone,
			email,
			tinNo,
			subcity,
			kebele,
			buildingNumber,
			floor,
			street,
			houseNumber
		} = form.data;

		// try {

		const existingCustomer = await db
			.select({ id: customers.id })
			.from(customers)
			.where(and(eq(customers.phone, phone), notDeleted(customers)));

		if (existingCustomer.length) {
			setError(form, 'phone', 'Customer with same phone number exists');
			return message(form, { type: 'error', text: 'Error: customer with the same number exists' });
		}

		const newCustomerResult = await db.transaction(async (tx) => {
			// 1. Insert Address
			const [addressRes] = await tx
				.insert(address)
				.values({
					subcityId: Number(subcity), // Handle potential NaN
					street,
					kebele,
					buildingNumber,
					floor,
					houseNumber
				})
				.$returningId();

			if (!addressRes) return message(form, { type: 'error', text: 'Failed to insert address' });

			// 2. Insert Customer using the new address ID
			const [customerRes] = await tx
				.insert(customers)
				.values({
					...asRequested(locals?.user?.id),
					name,
					phone,
					email,
					tinNo,
					address: addressRes.id,
					createdBy: locals?.user?.id
				})
				.$returningId();

			return customerRes;
		});

		if (!newCustomerResult)
			return message(form, { type: 'error', text: 'Unexpected Error,  please try again' });
		// Stay on the same page and set a flash message
		// setFlash({ type: 'success', message: 'Customer Successfully Added' }, cookies);
		redirect(
			`/dashboard/customers/${newCustomerResult.id}`,
			{ type: 'success', message: 'Customer Successfully Added!' },
			cookies
		);
		// } catch (err) {
		// 	console.error('Error' + err?.message);
		// 	if (err?.code === 'ER_DUP_ENTRY')
		// 		return setError(form, 'phone', 'Phone Number already exists.');
		// 	return message(form, {
		// 		type: 'error',
		// 		text:
		// 			err.code === 'ER_DUP_ENTRY'
		// 				? 'Phone number is already taken. Please choose another one.'
		// 				: err?.message
		// 	});
		// }
	}
};
