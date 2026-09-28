import { zod4 } from 'sveltekit-superforms/adapters';
import { db } from '$lib/server/db';
import { customers, user, address, subcity, customerContacts } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { alias } from 'drizzle-orm/mysql-core';
import { notDeleted, softDeleteCustomer, softDeleteOwnedRecord } from '$lib/server/softDelete';
import { hasPermission, requireSuperAdmin } from '$lib/server/permissions';
import { payerInvoices } from '$lib/server/billing';
import { openSessionFor } from '$lib/server/cashDrawer';
import { ownedAction } from '$lib/server/patientAction';
import { paymentMethodOptions, takePayerPayment } from '$lib/server/payments';
import { canPay } from '$lib/invoiceStatus';
import { payment } from '$lib/forms/payment';
import { formatETB } from '$lib/global.svelte';
import type { PageServerLoad } from './$types';
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
import { daysBetween, isoDate, today } from '$lib/server/db/dialect';

/** Who may see what a payer owes and take their money — the same as for a patient's bills. */
const BILLING_PERMISSION = 'billing.invoice';

/**
 * The payer's bills, what they owe, and what a payment form needs — or null for a viewer who may
 * keep the payer's details but not see money (the customers page is gated on `customers.record`).
 */
async function payerAccount(customerId: number, locals: App.Locals) {
	if (!hasPermission(locals, BILLING_PERMISSION)) return null;
	const [bills, methods, drawer, form] = await Promise.all([
		payerInvoices(customerId),
		paymentMethodOptions(),
		openSessionFor(db, locals.branch.active),
		superValidate(zod4(payment))
	]);
	return {
		bills,
		owed: bills.reduce((sum, b) => sum + b.owed, 0),
		payable: bills
			.filter((b) => canPay(b.status, b.approvalStatus) && b.owed > 0)
			.map((b) => ({
				id: b.id,
				number: b.invoiceNumber,
				owed: b.owed,
				issuedOn: b.issuedOn ?? '',
				who: b.patient
			})),
		methods,
		drawerOpen: drawer !== null,
		form
	};
}

/** The payer the path names, if it is live — or a 404. */
async function livePayerId(raw: string): Promise<number> {
	const id = Number(raw);
	const [row] = Number.isInteger(id)
		? await db
				.select({ id: customers.id })
				.from(customers)
				.where(and(eq(customers.id, id), notDeleted(customers)))
				.limit(1)
		: [];
	if (!row) error(404, 'Payer not found');
	return row.id;
}

export const load: PageServerLoad = async ({ params, locals }) => {
	const { id } = params;

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
			joinedOn: isoDate(customers.createdAt),
			daysSinceJoined: daysBetween(today(), customers.createdAt),
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
		error(404, 'Payer not found');
	}

	const account = await payerAccount(customer.id, locals);
	// Seeded from the payer, so the dialog opens on what is saved.
	const detailForm = await superValidate(
		{
			name: customer.name,
			phone: customer.phone,
			email: customer.email ?? undefined,
			tinNo: customer.tinNo,
			status: customer.status
		},
		zod4(editDetail),
		{ errors: false }
	);

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
		serviceList,
		account
	};
};

export const actions: Actions = {
	/** A payment from this payer across the bills billed to them (`takePayerPayment`). */
	pay: (event) =>
		ownedAction(
			event,
			BILLING_PERMISSION,
			payment,
			() => livePayerId(event.params.id ?? ''),
			async (tx, { ownerId, data }) => {
				await takePayerPayment(tx, event, {
					customerId: ownerId,
					allocations: data.allocations,
					paymentMethodId: Number(data.paymentMethodId),
					branchId: event.locals.branch.active,
					reference: data.reference ?? null
				});
				const total = data.allocations.reduce((sum, a) => sum + a.amount, 0);
				return `Payment of ${formatETB(total)} recorded.`;
			}
		),
	editDetail: async ({ request, locals, params }) => {
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
					email: email || null,
					isActive: status,
					updatedBy: locals?.user?.id
				})
				.where(eq(customers.id, Number(id)));

			// Stay on the same page and set a flash message
			return message(form, { type: 'success', text: 'Payer updated.' });
		} catch (err: unknown) {
			console.error('editDetail failed', err);
			return message(form, { type: 'error', text: 'Error: Something Went Wrong Try Again' });
		}
	},
	/**
	 * The customer's address. Which address is decided here, from the customer — never from the
	 * form. The form posted an address `id` and this updated whatever row it named, so a crafted
	 * POST could rewrite a patient's or an employee's address from a customer page.
	 */
	editAddress: async ({ request, params }) => {
		const form = await superValidate(request, zod4(editAddress));
		if (!form.valid) {
			return message(form, { type: 'error', text: `Error: check the form` });
		}
		const { street, subcity, kebele, buildingNumber, floor, houseNumber, status } = form.data;

		const [owner] = await db
			.select({ addressId: customers.address })
			.from(customers)
			.where(and(eq(customers.id, Number(params.id)), notDeleted(customers)))
			.limit(1);
		if (!owner?.addressId) {
			return message(form, { type: 'error', text: 'This customer has no address to edit.' });
		}

		/** A number typed into the form, or null when it was left empty or is not a number. */
		const whole = (value: string | undefined) => {
			const n = Number(value);
			return value?.trim() && Number.isInteger(n) ? n : null;
		};

		try {
			await db
				.update(address)
				.set({
					subcityId: subcity,
					street,
					kebele,
					buildingNumber,
					floor: whole(floor),
					houseNumber: whole(houseNumber),
					status
				})
				.where(eq(address.id, owner.addressId));
			return message(form, { type: 'success', text: 'Address Details Updated Successfully!' });
		} catch (err: unknown) {
			// Loud in the log, quiet to the client (CLAUDE.md §9).
			console.error('Error updating Address details:', err);
			return message(form, { type: 'error', text: 'The address could not be saved.' });
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

		redirect('/dashboard/customers', { type: 'success', message: 'Payer deleted.' }, cookies);
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
