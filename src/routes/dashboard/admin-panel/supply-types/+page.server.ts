import { setError, superValidate, message, fail } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { and, count, eq, sql } from 'drizzle-orm';
import { setFlash } from 'sveltekit-flash-message/server';

import { add, edit } from './schema';
import { db } from '$lib/server/db';
import { supplies, supplyTypes } from '$lib/server/db/schema/';
import { notDeleted, softDeleteLookup } from '$lib/server/softDelete';
import { requireSuperAdmin } from '$lib/server/permissions';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const form = await superValidate(zod4(add), { id: 'add' });
	const editForm = await superValidate(zod4(edit), { id: 'edit' });

	// The supply count is what makes this page useful: it says which types are
	// actually in use, and the delete action refuses the ones that are.
	const allData = await db
		.select({
			id: supplyTypes.id,
			name: supplyTypes.name,
			description: supplyTypes.description,
			supplyCount: sql<number>`COUNT(${supplies.id})`,
			totalStock: sql<number>`COALESCE(SUM(${supplies.quantity}), 0)`
		})
		.from(supplyTypes)
		.leftJoin(supplies, and(eq(supplies.supplyTypeId, supplyTypes.id), notDeleted(supplies)))
		.where(notDeleted(supplyTypes))
		.groupBy(supplyTypes.id, supplyTypes.name, supplyTypes.description)
		.orderBy(supplyTypes.name);

	return { form, editForm, allData };
};

export const actions: Actions = {
	add: async ({ request }) => {
		const form = await superValidate(request, zod4(add), { id: 'add' });

		if (!form.valid) {
			return message(form, { type: 'error', text: 'Please check the form for errors.' });
		}

		const { name, description } = form.data;

		// `supply_types.name` has no unique index, so the duplicate check has to
		// happen here rather than being caught as ER_DUP_ENTRY.
		const [existing] = await db
			.select({ id: supplyTypes.id })
			.from(supplyTypes)
			.where(and(eq(supplyTypes.name, name), notDeleted(supplyTypes)))
			.limit(1);

		if (existing) {
			return setError(form, 'name', 'A supply type with that name already exists.');
		}

		try {
			await db.insert(supplyTypes).values({ name, description: description?.trim() || null });
			return message(form, { type: 'success', text: 'Supply type added.' });
		} catch (err) {
			console.error('Error adding supply type:', err);
			return message(form, {
				type: 'error',
				text: err instanceof Error ? err.message : 'Could not add the supply type.'
			});
		}
	},

	edit: async ({ request }) => {
		const form = await superValidate(request, zod4(edit), { id: 'edit' });

		if (!form.valid) {
			return message(form, { type: 'error', text: 'Please check the form for errors.' });
		}

		const { id, name, description } = form.data;

		const [clash] = await db
			.select({ id: supplyTypes.id })
			.from(supplyTypes)
			.where(and(eq(supplyTypes.name, name), notDeleted(supplyTypes)))
			.limit(1);

		if (clash && clash.id !== id) {
			return setError(form, 'name', 'Another supply type already uses that name.');
		}

		try {
			await db
				.update(supplyTypes)
				.set({ name, description: description?.trim() || null })
				.where(and(eq(supplyTypes.id, id), notDeleted(supplyTypes)));

			return message(form, { type: 'success', text: 'Supply type updated.' });
		} catch (err) {
			console.error('Error updating supply type:', err);
			return message(form, {
				type: 'error',
				text: err instanceof Error ? err.message : 'Could not update the supply type.'
			});
		}
	},

	/**
	 * Soft delete, super admin only.
	 *
	 * This does not use the shared `lookupDeleteAction` because a supply type
	 * that is still in use has to be refused: `supplies.supply_type_id` is NOT
	 * NULL, so the row would stay referenced, and every supply under it would
	 * quietly lose its type on the list page — the join filters deleted types.
	 */
	delete: async ({ request, locals, cookies }) => {
		requireSuperAdmin(locals);

		const data = await request.formData();
		const rowId = Number(data.get('id'));

		if (!rowId) {
			setFlash({ type: 'error', message: 'No supply type was selected.' }, cookies);
			return fail(400);
		}

		const [{ inUse }] = await db
			.select({ inUse: count() })
			.from(supplies)
			.where(and(eq(supplies.supplyTypeId, rowId), notDeleted(supplies)));

		if (inUse > 0) {
			setFlash(
				{
					type: 'error',
					message: `That type still has ${inUse} supply item(s). Move or delete them first.`
				},
				cookies
			);
			return fail(400);
		}

		try {
			const deleted = await db.transaction(async (tx) =>
				softDeleteLookup(tx, supplyTypes, rowId, locals.user?.id)
			);

			if (!deleted) {
				setFlash({ type: 'error', message: 'That supply type was not found.' }, cookies);
				return fail(404);
			}
		} catch (err) {
			console.error('Error deleting supply type:', err);
			setFlash(
				{
					type: 'error',
					message: `Could not delete supply type: ${err instanceof Error ? err.message : 'Unknown error'}`
				},
				cookies
			);
			return fail(500);
		}

		setFlash({ type: 'success', message: 'Supply type deleted.' }, cookies);
		return { success: true };
	}
};
