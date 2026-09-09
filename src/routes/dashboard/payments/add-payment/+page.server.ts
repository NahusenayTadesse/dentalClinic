import { zod4 } from 'sveltekit-superforms/adapters';
import { editCustomer } from '$lib/ZodSchema';
import { db } from '$lib/server/db';
import {
	customers,
	transactions,
	site,
	user,
	address,
	subcity,
	customerContacts,
	customerContracts,
	siteContacts,
	siteContracts,
	services,
	vatAndWithHold,
	siteMonthlyPayments,
	bankAmount
} from '$lib/server/db/schema';
import { isApproved } from '$lib/server/approvals';
import { eq, and, desc, sql, count } from 'drizzle-orm';
import { notDeleted } from '$lib/server/softDelete';
import type { PageServerLoad } from '../$types';
import { superValidate } from 'sveltekit-superforms';
import { error, type Actions } from '@sveltejs/kit';
import { fail, message } from 'sveltekit-superforms';

import { paymentMethods } from '$lib/server/fastData';

import { add, edit } from './schema';
import { saveUploadedFile } from '$lib/server/upload';

export const load: PageServerLoad = async () => {
	const form = await superValidate(zod4(add));
	const editForm = await superValidate(zod4(edit));

	const contractList = await db
		.select({
			value: siteContracts.id,
			name: sql<string>`TRIM(CONCAT(COALESCE(${site.name}, ''), ' (Service: ', ${services.name}, ', ', ${siteContracts.monthlyAmount}, ')'))`,
			monthlyAmount: siteContracts.monthlyAmount
		})
		.from(siteContracts)
		.leftJoin(services, and(eq(siteContracts.serviceId, services.id), notDeleted(services)))
		.leftJoin(site, and(eq(siteContracts.siteId, site.id), notDeleted(site)))
		// An unapproved contract is not billable, so it never reaches the picker.
		.where(
			and(eq(siteContracts.isActive, true), notDeleted(siteContracts), isApproved(siteContracts))
		);

	const paymentMethodsList = await paymentMethods();

	const vats = await db
		.select()
		.from(vatAndWithHold)
		.then((rows) => rows[0]);

	return {
		form,
		editForm,
		vats,
		contractList,
		paymentMethods: paymentMethodsList
	};
};

export const actions: Actions = {
	add: async ({ request, locals }) => {
		const form = await superValidate(request, zod4(add));

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
				contract,
				paymentRequestFile,
				penaltyAmount,

				fsNumber,
				invoiceNumber,
				requestAmount,
				paymentAmount,
				paymentMethod,
				beforeVat,
				vat,
				requestChangeReason,
				withholdAmount,
				withholdFile,
				withholdInvoiceNumber,
				receiptFile,
				month,
				date
			} = form.data;

			const result = await db.transaction(async (tx) => {
				const paymentRequestFileUrl = paymentRequestFile
					? await saveUploadedFile(paymentRequestFile)
					: null;
				const withholdFileUrl = withholdFile ? await saveUploadedFile(withholdFile) : null;
				const receiptFileUrl = receiptFile ? await saveUploadedFile(receiptFile) : null;

				const [monthName, year] = month.split('_');

				const [transactionId] = await tx
					.insert(transactions)
					.values({
						recieptLink: receiptFileUrl,
						amount: paymentAmount,
						paymentStatus: 'pending',

						description: 'Customer Monthly Payment',
						paymentMethodId: paymentMethod,
						createdBy: locals?.user?.id
					})
					.$returningId();

				await tx.insert(siteMonthlyPayments).values({
					contractId: contract,
					paymentRequestFile: paymentRequestFileUrl,
					penaltyAmount,
					fsNumber,
					requestChangeReason,
					invoiceNumber,
					requestAmount,
					paymentAmount,
					beforeVat,
					vat,
					withholdAmount,
					withholdFile: withholdFileUrl,
					withholdInvoiceNumber,
					month: monthName,
					year: Number(year),
					date,
					transactionId: transactionId.id,
					createdBy: locals?.user?.id
				});

				return { success: true };
			});

			// 7. Success Response
			return message(form, {
				type: 'success',
				text: `Payment recorded successfully!`
			});
		} catch (err) {
			console.error('Server Action Error:', err);

			// Handle potential database errors (unique constraint, etc.)
			return message(
				form,
				{
					type: 'error',
					text: 'A database error occurred. Please try again. ' + err.message
				},
				{
					status: 500
				}
			);
		}
	}
};
