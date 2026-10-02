import { superValidate, message } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { error, fail } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { notDeleted, softDeleteSupplier } from '$lib/server/softDelete';
import { db } from '$lib/server/db';
import { supplySuppliers, subcity, address } from '$lib/server/db/schema/';
import { requireSuperAdmin } from '$lib/server/permissions';
import { setFlash, redirect } from 'sveltekit-flash-message/server';
import { subcities } from '$lib/server/fastData';
import { supplier } from '$lib/forms/supplier';
import { updateSupplier } from '$lib/server/suppliers';
import type { Actions, PageServerLoad } from './$types';

/** One supplier: its details, an edit dialog seeded from them, and soft delete. */
export const load: PageServerLoad = async ({ params }) => {
	const single = await db
		.select({
			id: supplySuppliers.id,
			name: supplySuppliers.name,
			phone: supplySuppliers.phone,
			email: supplySuppliers.email,
			subcityId: address.subcityId,
			subcity: subcity.name,
			street: address.street,
			kebele: address.kebele,
			buildingNumber: address.buildingNumber,
			floor: address.floor,
			houseNumber: address.houseNumber,
			description: supplySuppliers.description,
			status: supplySuppliers.status
		})
		.from(supplySuppliers)
		.leftJoin(address, and(eq(supplySuppliers.address, address.id), notDeleted(address)))
		.leftJoin(subcity, and(eq(address.subcityId, subcity.id), notDeleted(subcity)))
		.where(and(eq(supplySuppliers.id, Number(params.id)), notDeleted(supplySuppliers)))
		.then((rows) => rows[0]);
	if (!single) error(404, 'Supplier not found');

	// The dialog starts from what is saved, so the form is validated from the row itself.
	const editForm = await superValidate(
		{
			name: single.name,
			phone: single.phone,
			email: single.email ?? '',
			description: single.description ?? '',
			subcity: single.subcityId ?? undefined,
			street: single.street ?? '',
			kebele: single.kebele ?? '',
			buildingNumber: single.buildingNumber ?? '',
			floor: single.floor ?? 0,
			houseNumber: single.houseNumber ?? 0,
			status: single.status
		},
		zod4(supplier),
		{ errors: false }
	);

	return { editForm, single, subcitiesList: await subcities() };
};

export const actions: Actions = {
	edit: async ({ request, params }) => {
		const form = await superValidate(request, zod4(supplier));
		if (!form.valid) {
			return message(form, { type: 'error', text: 'Please check the form for errors' });
		}
		try {
			const found = await updateSupplier(Number(params.id), form.data);
			if (!found)
				return message(
					form,
					{ type: 'error', text: 'That supplier was not found' },
					{ status: 404 }
				);
		} catch (err: unknown) {
			// Loud in the log, quiet to the client (CLAUDE.md §9).
			console.error('update supplier failed', err);
			return message(
				form,
				{ type: 'error', text: 'The supplier could not be saved' },
				{ status: 500 }
			);
		}
		return message(form, { type: 'success', text: 'Supplier saved' });
	},

	/**
	 * Soft delete. Super admin only — `requireSuperAdmin` throws 403 rather than
	 * failing quietly, because the hidden button is UX, not access control.
	 *
	 * Not `lookupDeleteAction`: a supplier owns an address row, which goes too.
	 */
	delete: async ({ params, locals, cookies }) => {
		requireSuperAdmin(locals);
		const { id } = params;

		try {
			const deleted = await db.transaction(async (tx) =>
				softDeleteSupplier(tx, Number(id), locals.user?.id)
			);

			if (!deleted) {
				setFlash({ type: 'error', message: 'That supplier was not found.' }, cookies);
				return fail(404);
			}
		} catch (err) {
			console.error('Error deleting supplier:', err);
			setFlash(
				{
					type: 'error',
					message: 'The supplier could not be deleted.'
				},
				cookies
			);
			return fail(500);
		}

		redirect(
			'/dashboard/supplies/suppliers',
			{ type: 'success', message: 'Supplier deleted.' },
			cookies
		);
	}
};
