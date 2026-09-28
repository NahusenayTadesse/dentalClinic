import { superValidate, setError, message } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { eq, and } from 'drizzle-orm';
import { redirect } from 'sveltekit-flash-message/server';

import { notDeleted } from '$lib/server/softDelete';
import { db } from '$lib/server/db';
import { customers, address } from '$lib/server/db/schema/';
import { insertReturningId } from '$lib/server/db/insert';
import { asRequested } from '$lib/server/approvals';
import { isDuplicateKey } from '$lib/server/dbErrors';
import { subcities } from '$lib/server/fastData';
import { customerSchema as schema } from './schema';
import type { Actions, PageServerLoad } from './$types';

/**
 * Registering a payer — an employer or insurer. It starts pending (`asRequested`) and waits in
 * Approvals → Payers, like the rest of the maker-checker records.
 */
export const load: PageServerLoad = async () => ({
	form: await superValidate(zod4(schema)),
	subcityList: await subcities()
});

export const actions: Actions = {
	addCustomer: async ({ request, locals, cookies }) => {
		const form = await superValidate(request, zod4(schema));
		if (!form.valid) return message(form, { type: 'error', text: 'Please check the form.' });
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

		// Checked first for a message under the field; the unique TIN is caught below, since two
		// organisations can share a switchboard but never a tax number.
		const [samePhone] = await db
			.select({ id: customers.id })
			.from(customers)
			.where(and(eq(customers.phone, phone), notDeleted(customers)))
			.limit(1);
		if (samePhone) {
			return setError(form, 'phone', 'A payer with this phone number already exists.');
		}

		let id: number;
		try {
			id = await db.transaction(async (tx) => {
				const addressId = await insertReturningId(tx, address, {
					subcityId: subcity,
					street,
					kebele,
					buildingNumber,
					floor,
					houseNumber
				});
				return insertReturningId(tx, customers, {
					...asRequested(locals.user?.id),
					name,
					phone,
					email: email?.trim() || null,
					tinNo,
					address: addressId,
					createdBy: locals.user?.id
				});
			});
		} catch (err: unknown) {
			if (isDuplicateKey(err)) {
				return setError(form, 'tinNo', 'A payer with this TIN is already registered.');
			}
			console.error('Adding a payer failed:', err);
			return message(
				form,
				{ type: 'error', text: 'The payer could not be saved.' },
				{ status: 500 }
			);
		}

		redirect(`/dashboard/customers/${id}`, { type: 'success', message: 'Payer added.' }, cookies);
	}
};
