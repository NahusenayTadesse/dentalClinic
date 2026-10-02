import { and, asc, eq, inArray } from 'drizzle-orm';
import { message, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import type { RequestEvent } from '@sveltejs/kit';

import { contentCrud } from '$lib/server/crud';
import { db } from '$lib/server/db';
import { appointmentType, appointmentTypeServices, services } from '$lib/server/db/schema/';
import { lookupDeleteAction } from '$lib/server/lookupDelete';
import { notDeleted, softDeleteVisitTypeServices } from '$lib/server/softDelete';
import { add, edit, usualWork } from './schema';

/** Appointment types, as a plain lookup screen. */
const crud = contentCrud({
	table: appointmentType,
	label: 'Appointment Type',
	addSchema: add,
	editSchema: edit,
	uniqueField: 'name'
});

/**
 * The services a visit type can bring with it: whole-mouth work, active and not deleted. The same
 * three conditions `visitWork` offers them under, so nothing chosen here is silently dropped from
 * the completion panel. Tooth work is left out because it needs a tooth, which only the chart knows.
 */
const offerable = and(eq(services.area, 'mouth'), eq(services.status, true), notDeleted(services));

/*
 * Deliberately unannotated. Adding `: PageServerLoad` widens the return to the generic
 * signature, and `PageData` then loses `addForm`/`editForm`/`rows`.
 */
export const load = async () => {
	const [base, usual, serviceOptions, usualForm] = await Promise.all([
		crud.load(),
		db
			.select({
				appointmentTypeId: appointmentTypeServices.appointmentTypeId,
				serviceId: services.id,
				name: services.name
			})
			.from(appointmentTypeServices)
			.innerJoin(services, and(eq(services.id, appointmentTypeServices.serviceId), offerable))
			.where(notDeleted(appointmentTypeServices))
			.orderBy(asc(services.name)),
		db
			.select({ value: services.id, name: services.name, price: services.price })
			.from(services)
			.where(offerable)
			.orderBy(asc(services.name)),
		superValidate(zod4(usualWork), { id: 'usualWork' })
	]);
	return { ...base, usual, serviceOptions, usualForm };
};

export const actions = {
	add: crud.actions.add,
	edit: crud.actions.edit,
	/**
	 * Soft delete, super admin only. `appointment.appointment_type_id` is `set null`, so retiring
	 * a type leaves past appointments standing rather than rewriting what they were for.
	 */
	delete: lookupDeleteAction(appointmentType, 'appointment type'),

	/**
	 * Replaces the services a visit type brings with it. The route's own gate is the permission:
	 * this is configuration beside the type's other fields, which `edit` already changes under it.
	 *
	 * A link that is dropped is soft-deleted (`softDeleteVisitTypeServices`) rather than removed;
	 * one re-ticked later gets a new row. Not audited — the table is configuration, which §11 leaves to
	 * `updatedBy`, and no patient's record changes when it does.
	 */
	usualWork: async ({ request, locals }: RequestEvent) => {
		const form = await superValidate(request, zod4(usualWork), { id: 'usualWork' });
		if (!form.valid) {
			return message(form, { type: 'error', text: 'Please check the form for errors.' });
		}
		const { id, serviceIds } = form.data;
		const userId = locals.user?.id;

		try {
			const outcome = await db.transaction(async (tx) => {
				const [type] = await tx
					.select({ id: appointmentType.id })
					.from(appointmentType)
					.where(and(eq(appointmentType.id, id), notDeleted(appointmentType)))
					.limit(1);
				if (!type) return 'missing' as const;

				// Only services that may be offered; a posted id for a tooth service is dropped.
				const wanted = serviceIds.length
					? (
							await tx
								.select({ id: services.id })
								.from(services)
								.where(and(inArray(services.id, serviceIds), offerable))
						).map((s) => s.id)
					: [];

				/*
				 * Only the links the dialog showed. The seed also links tooth services (an extraction's
				 * "Simple extraction"), which the completion panel never offers; a save here must not
				 * quietly delete rows the person saving could not see.
				 */
				const current = await tx
					.select({ id: appointmentTypeServices.id, serviceId: appointmentTypeServices.serviceId })
					.from(appointmentTypeServices)
					.innerJoin(services, and(eq(services.id, appointmentTypeServices.serviceId), offerable))
					.where(
						and(
							eq(appointmentTypeServices.appointmentTypeId, id),
							notDeleted(appointmentTypeServices)
						)
					);

				const dropped = current.filter((c) => !wanted.includes(c.serviceId)).map((c) => c.id);
				const added = wanted.filter((s) => !current.some((c) => c.serviceId === s));

				await softDeleteVisitTypeServices(tx, dropped, userId);
				if (added.length) {
					await tx.insert(appointmentTypeServices).values(
						added.map((serviceId) => ({
							appointmentTypeId: id,
							serviceId,
							createdBy: userId,
							updatedBy: userId
						}))
					);
				}
				return 'saved' as const;
			});

			if (outcome === 'missing') {
				return message(
					form,
					{ type: 'error', text: 'That appointment type no longer exists.' },
					{ status: 404 }
				);
			}
			return message(form, { type: 'success', text: 'Usual work saved' });
		} catch (err: unknown) {
			console.error('[appointment-types] usual work failed:', err);
			return message(
				form,
				{ type: 'error', text: 'Could not save. Please try again.' },
				{ status: 500 }
			);
		}
	}
};
