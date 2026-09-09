import { zod4 } from 'sveltekit-superforms/adapters';
import { editCustomer } from '$lib/ZodSchema';
import { db } from '$lib/server/db';
import {
	transactions,
	siteMonthlyPayments,
	user,
	site,
	siteContracts,
	services
} from '$lib/server/db/schema';
import { eq, and, desc, sql, count } from 'drizzle-orm';
import { notDeleted } from '$lib/server/softDelete';
import type { PageServerLoad } from '../$types';
import { superValidate } from 'sveltekit-superforms';
import { error, type Actions } from '@sveltejs/kit';
import { fail, message } from 'sveltekit-superforms';
import { setFlash } from 'sveltekit-flash-message/server';

import { subcities, service, customerList } from '$lib/server/fastData';

import {} from './schema';
import { saveUploadedFile } from '$lib/server/upload';

export const load: PageServerLoad = async ({ params, locals }) => {
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
		.where(notDeleted(siteMonthlyPayments))
		.orderBy(desc(siteMonthlyPayments.date));

	return {
		payments
	};
};
