import { zod4 } from 'sveltekit-superforms/adapters';
import { db } from '$lib/server/db';
import {
	transactions,
	siteMonthlyPayments,
	user,
	services,
	site,
	customers,
	siteContracts,
	vatAndWithHold,
	paymentMethods,
	paymentRequest
} from '$lib/server/db/schema';
import { eq, and, sql, desc, inArray } from 'drizzle-orm';
import { notDeleted } from '$lib/server/softDelete';
import type { PageServerLoad, Actions } from '../$types';

import { superValidate, message } from 'sveltekit-superforms';
import { error } from '@sveltejs/kit';
import { service, officeEmployees } from '$lib/server/fastData';
import { add } from './schema';

type MonthEnum = (typeof paymentRequest.month.enumValues)[number];

export const load: PageServerLoad = async ({ params, locals }) => {
	// Duplicate guard, not a listing: deleted requests are deliberately still
	// counted. The row keeps its slot in the `unique_payment_per_month` index,
	// so hiding it would offer a re-create that then fails on a duplicate key.
	const existingRequests = await db
		.select({
			month: paymentRequest.month,
			year: paymentRequest.year,
			siteId: paymentRequest.siteId
		})
		.from(paymentRequest)
		.leftJoin(site, and(eq(site.id, paymentRequest.siteId), notDeleted(site)));

	const contracts = await db
		.select({
			id: siteContracts.id,
			siteName: site.name,
			siteId: site.id,
			customerName: customers.name,
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
		.leftJoin(site, and(eq(site.id, siteContracts.siteId), notDeleted(site)))
		.leftJoin(customers, and(eq(customers.id, site.customerId), notDeleted(customers)))
		.leftJoin(services, and(eq(siteContracts.serviceId, services.id), notDeleted(services)))
		.leftJoin(user, eq(siteContracts.createdBy, user.id));

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
			withholdInvoiceNumber: siteMonthlyPayments.withholdInvoiceNumber,
			paymentMethod: paymentMethods.name,
			requestFile: siteMonthlyPayments.paymentRequestFile,
			withholdFile: siteMonthlyPayments.withholdFile,
			contractId: siteContracts.id,
			receiptFile: transactions.recieptLink,
			transactionId: transactions.id,
			addedBy: user.name
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
		.leftJoin(paymentMethods, eq(transactions.paymentMethodId, paymentMethods.id))
		.leftJoin(user, eq(siteMonthlyPayments.createdBy, user.id))
		.where(notDeleted(siteMonthlyPayments))
		.orderBy(desc(siteMonthlyPayments.date));

	const employees = await officeEmployees();

	const contractList = await db
		.select({
			value: siteContracts.id,
			name: sql<string>`TRIM(CONCAT(COALESCE(${site.name}, ''), ' (Service: ', ${services.name}, ', ', ${siteContracts.monthlyAmount}, ')'))`,
			monthlyAmount: siteContracts.monthlyAmount
		})
		.from(siteContracts)
		.leftJoin(services, and(eq(siteContracts.serviceId, services.id), notDeleted(services)))
		.leftJoin(site, and(eq(siteContracts.siteId, site.id), notDeleted(site)))
		.where(and(eq(siteContracts.isActive, true), notDeleted(siteContracts)));

	// groupBy so a site with several contracts appears once
	const sitesList = await db
		.select({
			value: site.id,
			name: site.name,
			customerName: customers.name
		})
		.from(site)
		.leftJoin(customers, and(eq(site.customerId, customers.id), notDeleted(customers)))
		.innerJoin(siteContracts, and(eq(site.id, siteContracts.siteId), notDeleted(siteContracts)))
		.where(eq(siteContracts.isActive, true))
		.groupBy(site.id, site.name, customers.name);

	const vats = await db
		.select()
		.from(vatAndWithHold)
		.limit(1)
		.then((rows) => rows[0]);

	// Invoice numbers are now generated on the client when months are picked,
	// because the set of (site x months) isn't known at load time.
	const form = await superValidate(
		{
			vat: Number(vats.vat),
			withhold: Number(vats.withHold),
			months: [],
			items: []
		},
		zod4(add),
		{ errors: false } // don't show "min 1" errors before the user touches anything
	);

	return {
		payments,
		employees,
		contractList,
		serviceList,
		contracts,
		sitesList,
		existingRequests,
		vats,
		form
	};
};

export const actions: Actions = {
	request: async ({ request, locals }) => {
		const form = await superValidate(request, zod4(add));

		console.log('Form data:', form.data);

		if (!form.valid) {
			return message(form, {
				type: 'error',
				text: 'Validation failed. Please check the highlighted fields.'
			});
		}

		try {
			const { items, requestDate, requestor, vat, withhold } = form.data;
			const siteIds = items.map((i) => i.siteId);

			// 1. Amounts are computed on the server (sum of the site's active
			//    contracts) so the client can't tamper with them.
			const contractSums = await db
				.select({
					siteId: siteContracts.siteId,
					total: sql<string>`SUM(${siteContracts.monthlyAmount})`
				})
				.from(siteContracts)
				.where(
					and(
						eq(siteContracts.isActive, true),
						notDeleted(siteContracts),
						inArray(siteContracts.siteId, siteIds)
					)
				)
				.groupBy(siteContracts.siteId);

			const sumBySite = new Map(contractSums.map((r) => [r.siteId, Number(r.total)]));

			// 2. Race-condition guard: re-check per (site, month, year) instead of
			//    blocking the whole month globally like before.
			const existing = await db
				.select({
					siteId: paymentRequest.siteId,
					month: paymentRequest.month,
					year: paymentRequest.year
				})
				.from(paymentRequest)
				.where(inArray(paymentRequest.siteId, siteIds));

			const existingKeys = new Set(existing.map((r) => `${r.siteId}_${r.month}_${r.year}`));

			const rows: (typeof paymentRequest.$inferInsert)[] = [];
			const duplicates: string[] = [];

			for (const item of items) {
				const amount = sumBySite.get(item.siteId);
				if (!amount) continue; // site has no active contracts

				for (const my of item.months) {
					const [monthName, yearStr] = my.split('_');
					const year = Number(yearStr);

					if (existingKeys.has(`${item.siteId}_${monthName}_${year}`)) {
						duplicates.push(`site #${item.siteId} — ${monthName} ${year}`);
						continue;
					}

					rows.push({
						siteId: item.siteId,
						invoiceNumber: item.invoiceNumber,
						requestDate: new Date(requestDate),
						vat: String(vat),
						withholding: String(withhold), // NOTE: column key is `withholding`, not `withhold`
						amount: String(amount),
						month: monthName as MonthEnum,
						year,
						penality: String(item.penality ?? 0),
						requestedBy: requestor,
						status: 'pending',
						createdBy: locals.user?.id
					});
				}
			}

			if (duplicates.length) {
				console.warn('Duplicate requests detected:', duplicates);
				return message(form, {
					type: 'error',
					text: `Requests already exist for: ${duplicates.join(', ')}. Nothing was saved — refresh and try again.`
				});
			}

			if (!rows.length) {
				return message(form, {
					type: 'error',
					text: 'Nothing to insert — all selected months already have requests.'
				});
			}

			await db.transaction(async (tx) => {
				await tx.insert(paymentRequest).values(rows);
			});

			return message(form, {
				type: 'success',
				text: `${rows.length} payment request(s) recorded successfully!`
			});
		} catch (err) {
			console.error('Server Action Error:', err);
			return message(
				form,
				{ type: 'error', text: 'A database error occurred. Please try again.' },
				{ status: 500 }
			);
		}
	}
};
