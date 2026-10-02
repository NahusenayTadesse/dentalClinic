import { superValidate, message } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { eq } from 'drizzle-orm';

import { add } from './schema';
import { db } from '$lib/server/db';
import { vatAndWithHold as taxType } from '$lib/server/db/schema/';
import type { Actions, PageServerLoad } from './$types';

/**
 * The VAT and withholding rates — a one-row table. Saving changes that row in place (or makes it,
 * the first time); it used to delete every row and insert a fresh one, which gave the rate a new
 * id on every save.
 */
export const load: PageServerLoad = async () => {
	const [allData] = await db.select().from(taxType).limit(1);
	const form = await superValidate(allData ?? undefined, zod4(add));
	return { form, allData };
};

export const actions: Actions = {
	add: async ({ request }) => {
		const form = await superValidate(request, zod4(add));
		if (!form.valid) {
			return message(form, { type: 'error', text: 'Please check the form for errors' });
		}

		const { vat, withHold } = form.data;
		try {
			await db.transaction(async (tx) => {
				const [current] = await tx.select({ id: taxType.id }).from(taxType).limit(1);
				if (current)
					await tx.update(taxType).set({ vat, withHold }).where(eq(taxType.id, current.id));
				else await tx.insert(taxType).values({ vat, withHold });
			});
			return message(form, { type: 'success', text: 'VAT and withholding saved' });
		} catch (err: unknown) {
			// Loud in the log, quiet to the client (CLAUDE.md §9).
			console.error('vat-withhold: save failed', err);
			return message(
				form,
				{ type: 'error', text: 'The rates could not be saved' },
				{ status: 500 }
			);
		}
	}
};
