import { zod4 } from 'sveltekit-superforms/adapters';
import { editCustomer } from '$lib/ZodSchema';
import { db } from '$lib/server/db';
import { alias } from 'drizzle-orm/mysql-core';
import {
	transactions,
	siteMonthlyPayments,
	user,
	services,
	paymentMethods,
	site,
	siteContracts
} from '$lib/server/db/schema';
import { eq, and, inArray, desc } from 'drizzle-orm';
import { notDeleted, softDeletePayment } from '$lib/server/softDelete';
import {
	bankForPaymentMethod,
	bankNetForTransaction,
	postToBank,
	reverseBankPostings
} from '$lib/server/bankLedger';
import { requireSuperAdmin } from '$lib/server/permissions';
import { setFlash } from 'sveltekit-flash-message/server';
import type { PageServerLoad, Actions } from '../$types';

import { superValidate } from 'sveltekit-superforms';
import { error } from '@sveltejs/kit';
import { fail, message } from 'sveltekit-superforms';
import { approveContract, editContract } from './schema';
import {
	subcities,
	service,
	customerList,
	paymentMethods as paymentMethod
} from '$lib/server/fastData';

export const load: PageServerLoad = async ({ params, locals }) => {
	const form = await superValidate(zod4(approveContract));
	const editForm = await superValidate(zod4(editContract));

	// const contractYearMonth = await db
	// 	.select({
	// 		year: siteContracts.contractYear,
	// 		month: siteMonthlyPayments.month
	// 	})
	// 	.from(siteContracts)
	// 	.where(eq(siteContracts.id, Number(contractId)))
	// 	.then((rows) => rows[0]);

	const creator = alias(user, 'creator');
	const approver = alias(user, 'approver');
	// let contracts = await db
	// 	.select({
	// 		id: siteContracts.id,
	// 		serviceName: services.name,
	// 		service: siteContracts.serviceId,
	// 		startDate: siteContracts.startDate,
	// 		endDate: siteContracts.endDate,
	// 		contractDate: siteContracts.contractDate,
	// 		monthlyAmount: siteContracts.monthlyAmount,
	// 		contractYear: siteContracts.contractYear,
	// 		signedDate: siteContracts.contractDate,
	// 		contractFile: siteContracts.contractFile,
	// 		officeCommission: siteContracts.commissionConsidered,
	// 		commissionConsidered: siteContracts.commissionConsidered,
	// 		signingOfficer: siteContracts.signingOfficer,
	// 		addedBy: user.name,
	// 		addedById: user.id
	// 	})
	// 	.from(siteContracts)
	// 	.leftJoin(services, eq(siteContracts.serviceId, services.id))
	// 	.leftJoin(user, eq(siteContracts.createdBy, user.id));

	const serviceList = await service();
	const paymentMethodList = await paymentMethod();

	const contractsWithoutform = await db
		.select({
			id: siteMonthlyPayments.id,
			siteName: site.name,
			siteId: site.id,
			month: siteMonthlyPayments.month,
			serviceName: services.name,
			contractYear: siteContracts.contractYear,
			paymentMethod: paymentMethods.name,
			paymentMethodId: paymentMethods.id,
			year: siteMonthlyPayments.year,
			date: siteMonthlyPayments.date,
			requestAmount: siteMonthlyPayments.requestAmount,
			paymentAmount: siteMonthlyPayments.paymentAmount,
			penalityAmount: siteMonthlyPayments.penaltyAmount,
			vat: siteMonthlyPayments.vat,
			beforeVat: siteMonthlyPayments.beforeVat,
			withholdAmount: siteMonthlyPayments.withholdAmount,
			withholdInvoiceNumber: siteMonthlyPayments.withholdInvoiceNumber,
			invoiceNumber: siteMonthlyPayments.invoiceNumber,
			fsNumber: siteMonthlyPayments.fsNumber,
			// File Links
			withholdFile: siteMonthlyPayments.withholdFile,
			paymentRequestFile: siteMonthlyPayments.paymentRequestFile,
			// Joined Fields
			contractId: siteContracts.id,
			receiptFile: transactions.recieptLink,
			status: siteMonthlyPayments.status,
			transactionId: transactions.id,
			rejectedBy: approver.name,
			approvedById: approver.id,
			processedBy: creator.name,
			addedById: creator.id,
			requestChangeReason: siteMonthlyPayments.requestChangeReason
		})
		.from(siteMonthlyPayments)
		.innerJoin(
			siteContracts,
			and(eq(siteMonthlyPayments.contractId, siteContracts.id), notDeleted(siteContracts))
		)
		.leftJoin(site, and(eq(siteContracts.siteId, site.id), notDeleted(site)))
		.innerJoin(
			transactions,
			and(eq(siteMonthlyPayments.transactionId, transactions.id), notDeleted(transactions))
		)
		.leftJoin(paymentMethods, eq(transactions.paymentMethodId, paymentMethods.id))
		.leftJoin(creator, eq(siteMonthlyPayments.createdBy, creator.id))
		.leftJoin(approver, eq(siteMonthlyPayments.approvedBy, approver.id))
		.leftJoin(services, and(eq(siteContracts.serviceId, services.id), notDeleted(services)))
		.where(and(eq(siteMonthlyPayments.status, 'rejected'), notDeleted(siteMonthlyPayments)));

	const contracts = await Promise.all(
		contractsWithoutform.map(async (contract) => {
			return {
				...contract,
				// Pre-fill the form with the data from the DB record
				form: await superValidate(zod4(editContract)),
				paymentMethodList
			};
		})
	);

	return {
		serviceList,
		contracts,
		form,
		editForm
	};
};

import { saveUploadedFile } from '$lib/server/upload';

export const actions: Actions = {
	approve: async ({ request, locals, params }) => {
		const form = await superValidate(request, zod4(approveContract));

		console.log(form.data);

		if (!form.valid) {
			return message(form, { type: 'error', text: `Error: check the form` });
		}

		const { ids, status } = form.data;

		try {
			await db.transaction(async (tx) => {
				// The bank has to follow the status, not just the row. Money was added
				// when the payment was approved, so flipping it back to rejected has to
				// take that money out again — and re-approving has to put it back.
				const affected = await tx
					.select({
						paymentId: siteMonthlyPayments.id,
						transactionId: siteMonthlyPayments.transactionId,
						amount: siteMonthlyPayments.paymentAmount,
						paymentMethodId: transactions.paymentMethodId
					})
					.from(siteMonthlyPayments)
					.innerJoin(
						transactions,
						and(eq(siteMonthlyPayments.transactionId, transactions.id), notDeleted(transactions))
					)
					.where(and(inArray(siteMonthlyPayments.id, ids), notDeleted(siteMonthlyPayments)));

				await tx
					.update(siteMonthlyPayments)
					.set({
						status,
						approvedBy: locals?.user?.id
					})
					.where(and(inArray(siteMonthlyPayments.id, ids), notDeleted(siteMonthlyPayments)));

				for (const row of affected) {
					if (!row.transactionId) continue;

					if (status === 'approved') {
						const bankId = await bankForPaymentMethod(tx, row.paymentMethodId);
						// Guarded so re-approving an already-approved payment cannot add
						// the money twice.
						if (bankId && (await bankNetForTransaction(tx, row.transactionId)) === 0) {
							await postToBank(tx, {
								bankAmountId: bankId,
								transactionId: row.transactionId,
								amount: Number(row.amount),
								reason: 'Customer Monthly Payment',
								userId: locals?.user?.id
							});
						}
						await tx
							.update(transactions)
							.set({ paymentStatus: 'paid', updatedBy: locals?.user?.id })
							.where(eq(transactions.id, row.transactionId));
					} else {
						await reverseBankPostings(
							tx,
							row.transactionId,
							'Reversal: payment rejected',
							locals?.user?.id
						);
						await tx
							.update(transactions)
							.set({ paymentStatus: 'unpaid', updatedBy: locals?.user?.id })
							.where(eq(transactions.id, row.transactionId));
					}
				}
			});

			return message(form, {
				type: 'success',
				text: `Payment ${status === 'approved' ? 'Approved' : 'Rejected'} Successfully!`
			});
		} catch (err) {
			console.error(err?.message);
			return message(form, {
				type: 'error',
				text: `Updating Contract failed: ${err instanceof Error ? err.message : 'Unknown error'}`
			});
		}
	},

	editContract: async ({ request, locals }) => {
		const form = await superValidate(request, zod4(editContract));

		console.log(form);

		// 2. Check for validation errors (size, mime-type, required fields)
		if (!form.valid) {
			return message(form, {
				type: 'error',
				text: 'Validation failed. Please check the highlighted fields.'
			});
		}

		try {
			// 3. Destructure ALL fields from form.data
			const {
				id,
				transactionId,
				paymentRequestFile,
				penaltyAmount,
				fsNumber,
				invoiceNumber,
				requestAmount,
				paymentAmount,
				paymentMethod,
				beforeVat,
				vat,
				withholdAmount,
				withholdFile,
				withholdInvoiceNumber,
				receiptFile,
				month,
				status,
				date
			} = form.data;

			const result = await db.transaction(async (tx) => {
				if (paymentRequestFile) {
					const file = await saveUploadedFile(paymentRequestFile);

					await tx
						.update(siteMonthlyPayments)
						.set({ paymentRequestFile: file })
						.where(eq(siteMonthlyPayments.id, id));
				}

				if (withholdFile) {
					const file = await saveUploadedFile(withholdFile);

					await tx
						.update(siteMonthlyPayments)
						.set({ withholdFile: file })
						.where(eq(siteMonthlyPayments.id, id));
				}
				if (receiptFile) {
					const file = await saveUploadedFile(receiptFile);

					await tx
						.update(transactions)
						.set({ recieptLink: file })
						.where(eq(transactions.id, transactionId));
				}
				await tx
					.update(transactions)
					.set({ paymentMethodId: paymentMethod })
					.where(eq(transactions.id, transactionId));

				const [monthName, year] = month.split('_');

				await tx
					.update(siteMonthlyPayments)
					.set({
						penaltyAmount: String(penaltyAmount),
						fsNumber,
						status,
						invoiceNumber,
						requestAmount: String(requestAmount),
						paymentAmount: String(paymentAmount),
						beforeVat: String(beforeVat),
						vat: String(vat),
						withholdAmount: String(withholdAmount),
						withholdInvoiceNumber,
						month: monthName,
						year: Number(year),
						date: new Date(date),
						approvedBy: locals?.user?.id
					})
					.where(eq(siteMonthlyPayments.id, id));

				return { success: true };
			});

			// 7. Success Response
			return message(form, {
				type: 'success',
				text: `Payment updated successfully!`
			});
		} catch (err) {
			console.error('Server Action Error:', err);

			// Handle potential database errors (unique constraint, etc.)
			return message(
				form,
				{
					type: 'error',
					text: 'A database error occurred. Please try again.'
				},
				{
					status: 500
				}
			);
		}
	},

	/**
	 * Soft delete of one recorded payment. Super admin only — `requireSuperAdmin`
	 * throws 403 rather than failing quietly, because the hidden button is UX,
	 * not access control.
	 *
	 * The helper also deletes the transaction behind the payment, so the amount
	 * stops showing on the transactions listing too.
	 */
	delete: async ({ request, locals, cookies }) => {
		requireSuperAdmin(locals);

		const data = await request.formData();
		const paymentId = Number(data.get('id'));

		if (!paymentId) {
			setFlash({ type: 'error', message: 'No payment was selected.' }, cookies);
			return fail(400);
		}

		try {
			const deleted = await db.transaction(async (tx) =>
				softDeletePayment(tx, paymentId, locals.user?.id)
			);

			if (!deleted) {
				setFlash({ type: 'error', message: 'That payment was not found.' }, cookies);
				return fail(404);
			}
		} catch (err) {
			console.error('Error deleting payment:', err);
			setFlash(
				{
					type: 'error',
					message: `Could not delete payment: ${err instanceof Error ? err.message : 'Unknown error'}`
				},
				cookies
			);
			return fail(500);
		}

		setFlash({ type: 'success', message: 'Payment and its transaction deleted.' }, cookies);
		return { success: true };
	}
};
