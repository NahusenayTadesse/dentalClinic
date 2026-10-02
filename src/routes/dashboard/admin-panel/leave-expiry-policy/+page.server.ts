import { superValidate, message } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { eq, ne } from 'drizzle-orm';
import type { RequestEvent } from '@sveltejs/kit';
import { insertReturningId } from '@nahu/admin-kit/server/db/insert.js';
import { db } from '$lib/server/db';
import { leaveExpiryPolicy } from '$lib/server/db/schema/';
import { contentCrud } from '$lib/server/crud';
import { lookupDeleteAction } from '$lib/server/lookupDelete';
import { add, edit } from './schema';

/**
 * Leave expiry policies, on the lookup screen. The list is `contentCrud`'s; the writes are this
 * file's, because of the one rule a plain lookup cannot express: only one policy governs expiry at
 * a time, so activating one retires the rest — in the same transaction, so there is never a moment
 * with two.
 */
const crud = contentCrud({
	table: leaveExpiryPolicy,
	label: 'Expiry Policy',
	addSchema: add,
	editSchema: edit
});

/*
 * Deliberately unannotated. Adding `: PageServerLoad` widens the return to the generic
 * signature, and `PageData` then loses `addForm`/`editForm`/`rows`.
 */
export const load = crud.load;

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Retires every policy but `id`, when `id` is the one just made active. */
async function retireOthers(tx: Tx, id: number, active: boolean) {
	if (active)
		await tx.update(leaveExpiryPolicy).set({ status: false }).where(ne(leaveExpiryPolicy.id, id));
}

export const actions = {
	add: async ({ request }: RequestEvent) => {
		const form = await superValidate(request, zod4(add));
		if (!form.valid) {
			return message(form, { type: 'error', text: 'Please check the form for errors' });
		}
		try {
			await db.transaction(async (tx) => {
				const id = await insertReturningId(tx, leaveExpiryPolicy, form.data);
				await retireOthers(tx, id, form.data.status);
			});
		} catch (err: unknown) {
			// Loud in the log, quiet to the client (CLAUDE.md §9).
			console.error('add expiry policy failed', err);
			return message(
				form,
				{ type: 'error', text: 'The policy could not be added' },
				{ status: 500 }
			);
		}
		return message(form, { type: 'success', text: 'Expiry policy added' });
	},

	edit: async ({ request }: RequestEvent) => {
		const form = await superValidate(request, zod4(edit));
		if (!form.valid) {
			return message(form, { type: 'error', text: 'Please check the form for errors' });
		}
		const { id, ...values } = form.data;
		try {
			await db.transaction(async (tx) => {
				await tx.update(leaveExpiryPolicy).set(values).where(eq(leaveExpiryPolicy.id, id));
				await retireOthers(tx, id, values.status);
			});
		} catch (err: unknown) {
			console.error('edit expiry policy failed', err);
			return message(
				form,
				{ type: 'error', text: 'The policy could not be saved' },
				{ status: 500 }
			);
		}
		return message(form, { type: 'success', text: 'Expiry policy saved' });
	},

	/** Soft delete, super admin only. See `lookupDeleteAction`. */
	delete: lookupDeleteAction(leaveExpiryPolicy, 'expiry policy')
};
