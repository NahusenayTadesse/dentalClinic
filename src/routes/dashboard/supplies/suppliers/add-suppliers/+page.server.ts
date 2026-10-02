import { superValidate, message } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { redirect } from 'sveltekit-flash-message/server';
import { supplier } from '$lib/forms/supplier';
import { addSupplier } from '$lib/server/suppliers';
import { subcities } from '$lib/server/fastData';
import type { Actions, PageServerLoad } from './$types';

/** Adding a supplier. The write is `addSupplier`, shared with nothing else that adds one. */
export const load: PageServerLoad = async () => ({
	form: await superValidate(zod4(supplier)),
	subcitiesList: await subcities()
});

export const actions: Actions = {
	add: async ({ request, cookies }) => {
		const form = await superValidate(request, zod4(supplier));
		if (!form.valid) {
			return message(form, { type: 'error', text: 'Please check the form for errors' });
		}

		let id: number;
		try {
			id = await addSupplier(form.data);
		} catch (err: unknown) {
			// Loud in the log, quiet to the client (CLAUDE.md §9).
			console.error('add supplier failed', err);
			return message(
				form,
				{ type: 'error', text: 'The supplier could not be added' },
				{ status: 500 }
			);
		}
		redirect(
			`/dashboard/supplies/suppliers/${id}`,
			{ type: 'success', message: 'Supplier added.' },
			cookies
		);
	}
};
