import { and, asc, eq } from 'drizzle-orm';
import { message, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import type { RequestEvent } from '@sveltejs/kit';

import { contentCrud } from '$lib/server/crud';
import { db } from '$lib/server/db';
import { services, treatmentPackage } from '$lib/server/db/schema/';
import { lookupDeleteAction } from '$lib/server/lookupDelete';
import { notDeleted } from '$lib/server/softDelete';
import { WriteRefused } from '$lib/server/childCrud';
import { itemsOf, savePackageItems } from '$lib/server/packages';
import { add, edit, packageItems } from './schema';

/** Treatment packages, as a lookup screen. `''` days is no limit, which is not a number. */
const crud = contentCrud({
	table: treatmentPackage,
	label: 'Package',
	addSchema: add,
	editSchema: edit,
	transform: (values) => ({ ...values, validDays: Number(values.validDays) || null })
});

/*
 * Deliberately unannotated. Adding `: PageServerLoad` widens the return to the generic
 * signature, and `PageData` then loses `addForm`/`editForm`/`rows`.
 */
export const load = async () => {
	const [base, packages, serviceOptions, itemsForm] = await Promise.all([
		crud.load(),
		db
			.select({ id: treatmentPackage.id })
			.from(treatmentPackage)
			.where(notDeleted(treatmentPackage)),
		db
			.select({ value: services.id, name: services.name, price: services.price })
			.from(services)
			.where(and(eq(services.status, true), notDeleted(services)))
			.orderBy(asc(services.name)),
		superValidate(zod4(packageItems), { id: 'packageItems' })
	]);
	return {
		...base,
		items: await itemsOf(packages.map((p) => p.id)),
		serviceOptions,
		itemsForm
	};
};

export const actions = {
	add: crud.actions.add,
	edit: crud.actions.edit,
	/** Soft delete, super admin only. Packages already sold keep counting what they were sold with. */
	delete: lookupDeleteAction(treatmentPackage, 'package'),

	/** Replaces a package's services. The route's own gate is the permission, as for `edit`. */
	items: async ({ request, locals }: RequestEvent) => {
		const form = await superValidate(request, zod4(packageItems), { id: 'packageItems' });
		if (!form.valid)
			return message(form, { type: 'error', text: 'Check the form.' }, { status: 400 });
		try {
			await db.transaction((tx) =>
				savePackageItems(tx, locals.user?.id, form.data.id, form.data.items)
			);
		} catch (err: unknown) {
			if (err instanceof WriteRefused) {
				return message(form, { type: 'error', text: err.message }, { status: 400 });
			}
			console.error('[treatment-packages] items failed:', err);
			return message(form, { type: 'error', text: 'Nothing was saved.' }, { status: 500 });
		}
		return message(form, { type: 'success', text: 'Services saved.' });
	}
};
