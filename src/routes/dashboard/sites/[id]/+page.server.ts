import { zod4 } from 'sveltekit-superforms/adapters';
import { editCustomer } from '$lib/ZodSchema';
import { db } from '$lib/server/db';
import {
	customers,
	paymentMethods,
	transactions,
	site,
	user,
	address,
	subcity,
	customerContacts,
	siteContacts,
	services
} from '$lib/server/db/schema';
import { eq, and, desc, sql, count } from 'drizzle-orm';
import { alias } from 'drizzle-orm/mysql-core';
import { notDeleted, softDeleteSite, softDeleteOwnedRecord } from '$lib/server/softDelete';
import { requireSuperAdmin } from '$lib/server/permissions';
import type { PageServerLoad } from '../$types';
import { superValidate } from 'sveltekit-superforms';
import { error, type Actions } from '@sveltejs/kit';
import { fail, message } from 'sveltekit-superforms';
import { setFlash, redirect } from 'sveltekit-flash-message/server';

import { subcities, service, customerList } from '$lib/server/fastData';

import {
	editDetail,
	editAddress,
	addContact,
	editContact,
	addContract,
	editContract,
	addSites,
	editSites
} from './schema';
import { saveUploadedFile } from '$lib/server/upload';

export const load: PageServerLoad = async ({ params, locals }) => {
	const { id } = params;

	const detailForm = await superValidate(zod4(editDetail));
	const addressForm = await superValidate(zod4(editAddress));
	const addContactForm = await superValidate(zod4(addContact));
	const editContactForm = await superValidate(zod4(editContact));
	const addContractForm = await superValidate(zod4(addContract));
	const editContractForm = await superValidate(zod4(editContract));
	const editSiteForm = await superValidate(zod4(editSites));
	const addSiteForm = await superValidate(zod4(addSites));

	const subcityList = await subcities();
	const serviceList = await service();
	const customerListing = await customerList();

	// The approval trail names three different actors, so each needs its own join onto `user`.
	const requester = alias(user, 'requester');
	const approver = alias(user, 'approver');
	const updater = alias(user, 'updater');

	const singleSite = await db
		.select({
			id: site.id,
			name: site.name,
			customerName: customers.name,
			customerId: site.customerId,
			phone: site.phone,
			officeCommission: site.officeCommission,
			startedOn: sql<string>`DATE_FORMAT(${site.startDate}, '%Y-%m-%d')`,
			addedBy: user.name,
			addedById: user.id,
			status: site.isActive,
			approvalStatus: site.approvalStatus,
			requestedBy: requester.name,
			approvedBy: approver.name,
			approvedAt: site.approvedAt,
			updatedBy: updater.name
		})
		.from(site)
		.leftJoin(user, eq(site.createdBy, user.id))
		.leftJoin(requester, eq(site.requestedBy, requester.id))
		.leftJoin(approver, eq(site.approvedBy, approver.id))
		.leftJoin(updater, eq(site.updatedBy, updater.id))
		.leftJoin(customers, and(eq(customers.id, site.customerId), notDeleted(customers)))
		.where(and(eq(site.id, Number(id)), notDeleted(site)))
		.then((rows) => rows[0]);

	if (!singleSite) {
		error(404, 'Site with this id not found');
	}

	return {
		customer: singleSite,
		customerList: customerListing,
		customerAddress,
		detailForm,
		addressForm,
		subcityList,
		addContactForm,
		editContactForm,
		addContractForm,
		editContractForm,
		contacts,
		contracts,
		serviceList,
		editSiteForm,
		addSiteForm
	};
};

export const actions: Actions = {
	editDetail: async ({ request, locals, cookies, params }) => {
		const { id } = params;
		const form = await superValidate(request, zod4(editDetail));

		if (!form.valid) {
			// Stay on the same page and set a flash message
			return message(form, { type: 'error', text: 'Error: Please Check the form' });
		}
		const { name, phone, status, officeCommission, customer } = form.data;

		try {
			await db
				.update(site)
				.set({
					name,
					phone,
					customerId: customer,
					isActive: status,
					officeCommission,
					updatedBy: locals?.user?.id
				})
				.where(eq(site.id, Number(id)));

			// Stay on the same page and set a flash message
			return message(form, { type: 'success', text: 'Site updated Successfully Added' });
		} catch (err) {
			return message(form, { type: 'error', text: 'Error: Something Went Wrong Try Again' });
		}
	},
	editAddress: async ({ request }) => {
		const form = await superValidate(request, zod4(editAddress));
		if (!form.valid) {
			// Stay on the same page and set a flash message
			return message(form, { type: 'error', text: `Error: check the form` });
		}
		const { id, street, subcity, kebele, buildingNumber, floor, houseNumber, status } = form.data;

		try {
			if (!id) {
				return message(form, { type: 'error', text: `Employee Not Found` });
			}

			// Wrap the database operations in a transaction
			await db.transaction(async (tx) => {
				// 1. Update the employee identity

				await tx
					.update(address)
					.set({
						subcityId: subcity,
						street,
						kebele,
						buildingNumber,
						floor: Number(floor),
						houseNumber: Number(houseNumber),
						status
					})
					.where(eq(address.id, Number(id)));
			});
			return message(form, { type: 'success', text: 'Address Details Updated Successfully!' });
		} catch (err) {
			console.error('Error updating Address details:', err);
			return message(form, { type: 'error', text: `Unexpected Error: ${err?.message}` });
		}
	},
	addContact: async ({ request, locals, params }) => {
		const { id } = params;
		const form = await superValidate(request, zod4(addContact));

		if (!form.valid) {
			return message(form, { type: 'error', text: `Error: check the form` });
		}

		const { contactDetail, contactType, status } = form.data;

		try {
			await db.transaction(async (tx) => {
				await tx.insert(siteContacts).values({
					siteId: Number(id),
					contactDetail,
					contactType,
					isActive: status,
					createdBy: locals?.user?.id
				});

				return message(form, {
					type: 'success',
					text: 'Contact Details Created Successfully!'
				});
			});
		} catch (err) {
			return message(form, {
				type: 'error',
				text: `Creating Contact failed: ${err instanceof Error ? err.message : 'Unknown error'}`
			});
		}
	},
	editContact: async ({ request, locals }) => {
		const form = await superValidate(request, zod4(editContact));

		if (!form.valid) {
			return message(form, { type: 'error', text: `Error: check the form` });
		}

		const { id, contactDetail, contactType, status } = form.data;

		try {
			await db.transaction(async (tx) => {
				await tx
					.update(siteContacts)
					.set({
						contactDetail,
						contactType,
						isActive: status,
						updatedBy: locals?.user?.id
					})
					.where(eq(siteContacts.id, id));

				return message(form, {
					type: 'success',
					text: 'Contact Details Updated Successfully!'
				});
			});
		} catch (err) {
			return message(form, {
				type: 'error',
				text: `Updated Contact failed: ${err instanceof Error ? err.message : 'Unknown error'}`
			});
		}
	},

	editSite: async ({ request, locals }) => {
		const form = await superValidate(request, zod4(editSites));

		if (!form.valid) {
			return message(form, { type: 'error', text: `Error: check the form` });
		}

		const { id, name, phone, startDate, endDate, status } = form.data;

		try {
			await db.transaction(async (tx) => {
				await tx
					.update(site)
					.set({
						name,
						phone,
						startDate: new Date(startDate),
						endDate: new Date(endDate),
						isActive: status,
						updatedBy: locals?.user?.id
					})
					.where(eq(site.id, id));

				return message(form, {
					type: 'success',
					text: 'Site Details Updated Successfully!'
				});
			});
		} catch (err) {
			return message(form, {
				type: 'error',
				text: `Updated failed: ${err instanceof Error ? err.message : 'Unknown error'}`
			});
		}
	},

	/**
	 * Soft delete. Super admin only — `requireSuperAdmin` throws 403 rather than
	 * failing quietly, because the hidden button is UX, not access control.
	 */
	delete: async ({ locals, params, cookies }) => {
		requireSuperAdmin(locals);
		const { id } = params;

		try {
			await db.transaction(async (tx) => {
				await softDeleteSite(tx, Number(id), locals.user?.id);
			});
		} catch (err) {
			console.error('Error deleting site:', err);
			setFlash(
				{
					type: 'error',
					message: `Could not delete site: ${err instanceof Error ? err.message : 'Unknown error'}`
				},
				cookies
			);
			return fail(500);
		}

		redirect(
			'/dashboard/sites',
			{ type: 'success', message: 'Site and its contracts deleted.' },
			cookies
		);
	},
	/**
	 * Soft delete of one site. Super admin only — `requireSuperAdmin` throws
	 * 403 rather than failing quietly, because the hidden button is UX, not
	 * access control.
	 */
	deleteContact: async ({ request, params, locals, cookies }) => {
		requireSuperAdmin(locals);

		const data = await request.formData();
		const contactId = Number(data.get('id'));

		if (!contactId) {
			setFlash({ type: 'error', message: 'No contact was selected.' }, cookies);
			return fail(400);
		}

		try {
			const deleted = await db.transaction(async (tx) =>
				softDeleteOwnedRecord(
					tx,
					siteContacts,
					siteContacts.siteId,
					contactId,
					Number(params.id),
					locals.user?.id
				)
			);

			if (!deleted) {
				// Either already gone, or the id belongs to a different site.
				setFlash({ type: 'error', message: 'That contact was not found.' }, cookies);
				return fail(404);
			}
		} catch (err) {
			console.error('Error deleting contact:', err);
			setFlash(
				{
					type: 'error',
					message: `Could not delete contact: ${err instanceof Error ? err.message : 'Unknown error'}`
				},
				cookies
			);
			return fail(500);
		}

		setFlash({ type: 'success', message: 'Contact deleted.' }, cookies);
		return { success: true };
	}
};
