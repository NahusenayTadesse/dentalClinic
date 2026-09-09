import { superValidate, setError, message } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { eq, and, or, sql } from 'drizzle-orm';
import { notDeleted } from '$lib/server/softDelete';
import { customerSchema as schema } from './schema';
import { db } from '$lib/server/db';
import { customers, address, site } from '$lib/server/db/schema/';
import { asRequested } from '$lib/server/approvals';
import { subcities, customerList } from '$lib/server/fastData';
import type { Actions } from './$types';
import type { PageServerLoad } from './$types.js';
import { setFlash, redirect } from 'sveltekit-flash-message/server';

export const load: PageServerLoad = async () => {
	const form = await superValidate(zod4(schema));

	const subcityList = await subcities();
	const cusList = await customerList();

	return {
		form,
		subcityList,
		cusList
	};
};

export const actions: Actions = {
	addSite: async ({ request, locals, cookies }) => {
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
			customer,
			startDate,
			street,
			houseNumber
		} = form.data;

		// try {

		const existingCustomer = await db
			.select({ id: site.id })
			.from(site)
			.where(and(sql`lower(trim(${site.name})) = ${name.trim().toLowerCase()}`, notDeleted(site)));

		if (existingCustomer.length) {
			setError(form, 'name', 'Site with same name exists');
			return message(form, { type: 'error', text: 'Error: Site with the same name exists' });
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
				.insert(site)
				.values({
					...asRequested(locals?.user?.id),
					name,
					phone,
					startDate,
					customerId: customer,
					email,
					tinNo,
					address: addressRes.id,
					createdBy: locals?.user?.id
				})
				.$returningId();

			return customerRes;
		});

		if (!newCustomerResult)
			return message(
				form,
				{ type: 'error', text: 'Unexpected Error,  please try again' },
				{ status: 500 }
			);
		// Stay on the same page and set a flash message
		// setFlash({ type: 'success', message: 'Customer Successfully Added' }, cookies);
		redirect(
			`/dashboard/sites/${newCustomerResult.id}`,
			{ type: 'success', message: 'Site Successfully Added!' },
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
