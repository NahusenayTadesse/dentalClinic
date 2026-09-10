import { zod4 } from 'sveltekit-superforms/adapters';
import { db } from '$lib/server/db';
import { customers, user, address, subcity, customerContacts } from '$lib/server/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/mysql-core';
import { notDeleted, softDeleteCustomer, softDeleteOwnedRecord } from '$lib/server/softDelete';
import { requireSuperAdmin } from '$lib/server/permissions';
import type { PageServerLoad } from '../$types';
import { superValidate } from 'sveltekit-superforms';
import { error, type Actions } from '@sveltejs/kit';
import { fail, message } from 'sveltekit-superforms';
import { setFlash, redirect } from 'sveltekit-flash-message/server';

import { subcities, service } from '$lib/server/fastData';

import {
	editDetail,
	editAddress,
	addContact,
	editContact,
	addContract,
	editContract
} from './schema';

export const load: PageServerLoad = async ({ params, locals }) => {
	const { id } = params;

	const detailForm = await superValidate(zod4(editDetail));
	const addressForm = await superValidate(zod4(editAddress));
	const addContactForm = await superValidate(zod4(addContact));
	const editContactForm = await superValidate(zod4(editContact));
	const addContractForm = await superValidate(zod4(addContract));
	const editContractForm = await superValidate(zod4(editContract));

	const subcityList = await subcities();
	const serviceList = await service();

	// The approval trail names three different actors, so each needs its own join onto `user`.
	const requester = alias(user, 'requester');
	const approver = alias(user, 'approver');
	const updater = alias(user, 'updater');

	const customer = await db
		.select({
			id: customers.id,
			name: customers.name,
			phone: customers.phone,
			email: customers.email,
			tinNo: customers.tinNo,
			status: customers.isActive,
			joinedOn: sql<string>`DATE_FORMAT(${customers.createdAt}, '%Y-%m-%d')`,
			daysSinceJoined: sql<number>`DATEDIFF(CURRENT_DATE, ${customers.createdAt})`,
			addedBy: user.name,
			addedById: user.id,
			approvalStatus: customers.approvalStatus,
			requestedBy: requester.name,
			approvedBy: approver.name,
			approvedAt: customers.approvedAt,
			updatedBy: updater.name
		})
		.from(customers)
		.leftJoin(user, eq(customers.createdBy, user.id))
		.leftJoin(requester, eq(customers.requestedBy, requester.id))
		.leftJoin(approver, eq(customers.approvedBy, approver.id))
		.leftJoin(updater, eq(customers.updatedBy, updater.id))
		.where(and(eq(customers.id, Number(id)), notDeleted(customers)))
		.groupBy(
			customers.id,
			user.name,
			requester.name,
			approver.name,
			updater.name,
			customers.createdAt,
			customers.name,
			customers.phone
		)
		.then((rows) => rows[0]);

	if (!customer) {
		error(404, 'Customer with this id not found');
	}

	const customerAddress = await db
		.select({
			id: address.id,
			street: address.street,
			subcity: subcity.name,
			subcityId: subcity.id,
			kebele: address.kebele,
			buildingNumber: address.buildingNumber,
			floor: address.floor,
			houseNumber: address.houseNumber,
			status: address.status
		})
		.from(address)
		.leftJoin(customers, and(eq(customers.address, address.id), notDeleted(customers)))
		.leftJoin(subcity, and(eq(address.subcityId, subcity.id), notDeleted(subcity)))
		.where(eq(customers.id, Number(id)))
		.then((rows) => rows[0]);

	const contacts = await db
		.select({
			id: customerContacts.id,
			contactType: customerContacts.contactType,
			contactDetail: customerContacts.contactDetail,
			status: customerContacts.isActive,
			addedBy: user.name,
			addedById: user.id
		})
		.from(customerContacts)
		.leftJoin(user, eq(customerContacts.createdBy, user.id))
		.where(and(eq(customerContacts.customerId, Number(id)), notDeleted(customerContacts)));

	return {
		customer,
		customerAddress,
		detailForm,
		addressForm,
		subcityList,
		addContactForm,
		editContactForm,
		addContractForm,
		editContractForm,
		contacts,
		serviceList
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
		const { name, phone, tinNo, email, status } = form.data;

		try {
			await db
				.update(customers)
				.set({
					name,
					phone,
					tinNo,
					email,
					isActive: status,
					updatedBy: locals?.user?.id
				})
				.where(eq(customers.id, Number(id)));

			// Stay on the same page and set a flash message
			return message(form, { type: 'success', text: 'Customer updated Successfully Added' });
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
						floor,
						houseNumber,
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
				await tx.insert(customerContacts).values({
					customerId: Number(id),
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
					.update(customerContacts)
					.set({
						contactDetail,
						contactType,
						isActive: status,
						updatedBy: locals?.user?.id
					})
					.where(eq(customerContacts.id, id));

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

	delete: async ({ locals, params, cookies }) => {
		requireSuperAdmin(locals);
		const { id } = params;

		try {
			await db.transaction(async (tx) => {
				await softDeleteCustomer(tx, Number(id), locals.user?.id);
			});
		} catch (err) {
			console.error('Error deleting customer:', err);
			setFlash(
				{
					type: 'error',
					message: `Could not delete customer: ${err instanceof Error ? err.message : 'Unknown error'}`
				},
				cookies
			);
			return fail(500);
		}

		redirect('/dashboard/customers', { type: 'success', message: 'Customer deleted.' }, cookies);
	},
	/**
	 * Soft delete of one customer. Super admin only — `requireSuperAdmin` throws
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
					customerContacts,
					customerContacts.customerId,
					contactId,
					Number(params.id),
					locals.user?.id
				)
			);

			if (!deleted) {
				// Either already gone, or the id belongs to a different customer.
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
