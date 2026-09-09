import { setError, superValidate, message, fail } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { and, eq } from 'drizzle-orm';
import { notDeleted, softDeleteSupplier } from '$lib/server/softDelete';

import { add, edit } from './schema';
import { db } from '$lib/server/db';
import { supplySuppliers, supplies, subcity, address } from '$lib/server/db/schema/';
import { requireSuperAdmin } from '$lib/server/permissions';
import { setFlash, redirect } from 'sveltekit-flash-message/server';
import type { Actions } from './$types';
import type { PageServerLoad } from './$types.js';
import { subcities, cities } from '$lib/server/fastData';
export const load: PageServerLoad = async ({ params }) => {
	const form = await superValidate(zod4(add));
	const editForm = await superValidate(zod4(edit));
	const { id } = params;

	const single = await db
		.select({
			id: supplySuppliers.id,
			name: supplySuppliers.name,
			phone: supplySuppliers.phone,
			email: supplySuppliers.email,
			subcityId: address.subcityId,
			subcity: subcity.name,
			addressId: address.id,
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
		.where(and(eq(supplySuppliers.id, Number(id)), notDeleted(supplySuppliers)))
		.then((rows) => rows[0]);

	const subcitiesList = await subcities();

	return {
		form,
		editForm,
		single,
		subcitiesList
	};
};

export const actions: Actions = {
	edit: async ({ request, params }) => {
		const form = await superValidate(request, zod4(edit));
		const { id } = params;
		if (!form.valid) {
			return message(form, { type: 'error', text: 'Please check the form for Errors' });
		}

		const {
			name,
			addressId,
			subcity,
			email,
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
			await db
				.update(address)
				.set({
					subcityId: Number(subcity),
					street,
					kebele,
					buildingNumber,
					floor,
					houseNumber
				})
				.where(eq(address.id, Number(addressId)));

			await db
				.update(supplySuppliers)
				.set({
					name,
					phone,
					email,
					description,
					status: status
				})
				.where(eq(supplySuppliers.id, id));

			return message(form, { type: 'success', text: 'Supplier Successfully Updated' });
		} catch (err: any) {
			return message(form, {
				type: 'error',
				text: 'Error: ' + err?.message
			});
		}
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
					message: `Could not delete supplier: ${err instanceof Error ? err.message : 'Unknown error'}`
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
