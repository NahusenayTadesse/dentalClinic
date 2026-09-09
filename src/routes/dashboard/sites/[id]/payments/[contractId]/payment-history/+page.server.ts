import { zod4 } from 'sveltekit-superforms/adapters';
import { editCustomer } from '$lib/ZodSchema';
import { db } from '$lib/server/db';
import {
	transactions,
	siteMonthlyPayments,
	user,
	services,
	siteContracts
} from '$lib/server/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { notDeleted } from '$lib/server/softDelete';
import type { PageServerLoad, Actions } from '../$types';

import { superValidate } from 'sveltekit-superforms';
import { error } from '@sveltejs/kit';
import { fail, message } from 'sveltekit-superforms';
import { editContract } from './schema';
import { subcities, service, customerList } from '$lib/server/fastData';

export const load: PageServerLoad = async ({ params, locals }) => {
	const { contractId } = params;

	const form = await superValidate(zod4(editContract));

	// const contractYearMonth = await db
	// 	.select({
	// 		year: siteContracts.contractYear,
	// 		month: siteMonthlyPayments.month
	// 	})
	// 	.from(siteContracts)
	// 	.where(eq(siteContracts.id, Number(contractId)))
	// 	.then((rows) => rows[0]);

	let contracts = await db
		.select({
			id: siteContracts.id,
			serviceName: services.name,
			service: siteContracts.serviceId,
			startDate: siteContracts.startDate,
			endDate: siteContracts.endDate,
			contractDate: siteContracts.contractDate,
			monthlyAmount: siteContracts.monthlyAmount,
			contractYear: siteContracts.contractYear,
			signedDate: siteContracts.contractDate,
			contractFile: siteContracts.contractFile,
			officeCommission: siteContracts.commissionConsidered,
			commissionConsidered: siteContracts.commissionConsidered,
			status: siteContracts.isActive,
			signingOfficer: siteContracts.signingOfficer,
			addedBy: user.name,
			addedById: user.id
		})
		.from(siteContracts)
		.leftJoin(services, and(eq(siteContracts.serviceId, services.id), notDeleted(services)))
		.leftJoin(user, eq(siteContracts.createdBy, user.id))
		.where(and(eq(siteContracts.id, Number(contractId)), notDeleted(siteContracts)))
		.then((rows) => rows[0]);

	const serviceList = await service();

	if (!contracts) {
		error(404, 'Contract not found');
	}

	const payments = await db
		.select({
			id: siteMonthlyPayments.id,
			month: siteMonthlyPayments.month,
			year: siteMonthlyPayments.year,
			date: siteMonthlyPayments.date,
			requestAmount: siteMonthlyPayments.requestAmount,
			paymentAmount: siteMonthlyPayments.paymentAmount,
			penaltyAmount: siteMonthlyPayments.penaltyAmount,
			vat: siteMonthlyPayments.vat,
			withholdAmount: siteMonthlyPayments.withholdAmount,
			invoiceNumber: siteMonthlyPayments.invoiceNumber,
			fsNumber: siteMonthlyPayments.fsNumber,
			// File Links
			requestFile: siteMonthlyPayments.paymentRequestFile,
			withholdFile: siteMonthlyPayments.withholdFile,
			// Joined Fields
			contractId: siteContracts.id,
			receiptFile: transactions.recieptLink,
			transactionId: transactions.id,
			addedBy: user.name // Join on createdBy
		})
		.from(siteMonthlyPayments)
		.innerJoin(
			siteContracts,
			and(eq(siteMonthlyPayments.contractId, siteContracts.id), notDeleted(siteContracts))
		)
		.innerJoin(
			transactions,
			and(eq(siteMonthlyPayments.transactionId, transactions.id), notDeleted(transactions))
		)
		.leftJoin(user, eq(siteMonthlyPayments.createdBy, user.id))
		.where(
			and(eq(siteMonthlyPayments.contractId, Number(contractId)), notDeleted(siteMonthlyPayments))
		)
		.orderBy(desc(siteMonthlyPayments.date));

	return {
		payments,
		serviceList,
		contracts,
		form
	};
};

import { saveUploadedFile } from '$lib/server/upload';

export const actions: Actions = {
	editContract: async ({ request, locals, params }) => {
		const form = await superValidate(request, zod4(editContract));

		if (!form.valid) {
			return message(form, { type: 'error', text: `Error: check the form` });
		}

		const {
			id,
			service,
			contractDate,
			contractYear,
			startDate,
			endDate,
			contractFile,
			monthlyAmount,
			status,
			commissionConsidered,
			signingOfficer
		} = form.data;

		try {
			await db.transaction(async (tx) => {
				if (contractFile) {
					const contractFileName = await saveUploadedFile(contractFile);

					await tx
						.update(siteContracts)
						.set({
							serviceId: service,
							contractDate: new Date(contractDate),
							contractYear,
							startDate: new Date(startDate),
							endDate: new Date(endDate),
							contractFile: contractFileName,
							monthlyAmount: String(monthlyAmount),
							isActive: status,
							commissionConsidered,
							signingOfficer,
							updatedBy: locals?.user?.id
						})
						.where(eq(siteContracts.id, id));
				} else {
					await tx
						.update(siteContracts)
						.set({
							serviceId: service,
							contractDate: new Date(contractDate),
							contractYear,
							startDate: new Date(startDate),
							endDate: new Date(endDate),
							monthlyAmount: String(monthlyAmount),
							isActive: status,
							commissionConsidered,
							signingOfficer,
							updatedBy: locals?.user?.id
						})
						.where(eq(siteContracts.id, id));
				}

				return message(form, {
					type: 'success',
					text: 'Contract Updated Successfully!'
				});
			});
		} catch (err) {
			console.error(err?.message);
			return message(form, {
				type: 'error',
				text: `Updating Contract failed: ${err instanceof Error ? err.message : 'Unknown error'}`
			});
		}
	}
};
