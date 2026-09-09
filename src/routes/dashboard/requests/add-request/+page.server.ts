import { zod4 } from 'sveltekit-superforms/adapters';
import { editCustomer } from '$lib/ZodSchema';
import { db } from '$lib/server/db';
import {
	transactions,
	siteMonthlyPayments,
	user,
	services,
	site,
	customers,
	siteContracts,
	employee,
	vatAndWithHold,
	employmentStatuses,
	paymentMethods,
	employeeTermination,
	penality,
	paymentRequest
} from '$lib/server/db/schema';
import { eq, and, isNull, sql, desc, inArray } from 'drizzle-orm';
import { notDeleted } from '$lib/server/softDelete';
import type { PageServerLoad, Actions } from '../$types';

import { setError, superValidate } from 'sveltekit-superforms';
import { error } from '@sveltejs/kit';
import { fail, message } from 'sveltekit-superforms';
import { subcities, service, customerList, officeEmployees } from '$lib/server/fastData';
import { add } from './schema';

export const load: PageServerLoad = async ({ params, locals }) => {
	// Duplicate guard, not a listing: deleted requests are deliberately still
	// counted. The row keeps its slot in the `unique_payment_per_month` index,
	// so hiding it would offer a re-create that then fails on a duplicate key.
	let existingRequests = await db
		.select({
			month: paymentRequest.month,
			year: paymentRequest.year,
			siteId: paymentRequest.siteId
		})
		.from(paymentRequest)
		.leftJoin(site, and(eq(site.id, paymentRequest.siteId), notDeleted(site)));

	let contracts = await db
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
		.leftJoin(user, eq(siteContracts.createdBy, user.id))
		.where(notDeleted(siteContracts));

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

	const sitesList = await db
		.select({
			value: site.id,
			name: site.name,
			customerName: customers.name
		})
		.from(site)
		.leftJoin(customers, and(eq(site.customerId, customers.id), notDeleted(customers)))
		.innerJoin(siteContracts, and(eq(site.id, siteContracts.siteId), notDeleted(siteContracts)))
		.where(notDeleted(site));

	const vats = await db
		.select()
		.from(vatAndWithHold)
		.limit(1)
		.then((rows) => rows[0]);

	const invoiceNumbers = sitesList.map((contract, index) => {
		const timestamp = Date.now();
		const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();

		// Format: INV-[ContractID]-[Timestamp]-[Random/Index]
		return `INV-${contract.value}-${timestamp}-${index}${randomStr}`;
	});

	const form = await superValidate(
		{
			contracts: sitesList.map((contract) => contract.value),
			invoiceNumbers,
			vat: Number(vats.vat),
			withhold: Number(vats.withHold)
		},
		zod4(add)
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
			const { contracts, invoiceNumbers, vat, withhold, requestor, requestDate, month } = form.data;

			// Typed at the split so `monthName` lines up with the column's enum in both
			// the duplicate lookup and the insert, instead of being cast at each use.
			const [monthName, year] = month.split('_') as [
				(typeof paymentRequest.month.enumValues)[number],
				string
			];

			// Scoped to the sites being submitted, not to the month as a whole: one site
			// already having a request for this month must not block every other site.
			// Deleted rows still count — the site was billed for that period either way,
			// and re-creating it would put a second invoice on the same month.
			const alreadyRequested = new Set(
				await db
					.select({ siteId: paymentRequest.siteId })
					.from(paymentRequest)
					.where(
						and(
							inArray(paymentRequest.siteId, contracts),
							eq(paymentRequest.month, monthName),
							eq(paymentRequest.year, Number(year))
						)
					)
					.then((rows) => rows.map((row) => row.siteId))
			);

			// Paired up by index first, because `invoiceNumbers` is positional against
			// `contracts` and filtering either one alone would slide them out of step.
			const seen = new Set<number>();
			const toRequest = contracts
				.map((siteId, index) => ({ siteId, invoiceNumber: invoiceNumbers[index] }))
				.filter(({ siteId }) => {
					// `sitesList` joins contracts without grouping, so a site with three
					// contracts arrives here three times. One request covers the whole site,
					// so the first occurrence wins and the rest are dropped.
					if (alreadyRequested.has(siteId) || seen.has(siteId)) return false;
					seen.add(siteId);
					return true;
				});

			if (!toRequest.length) {
				setError(
					form,
					'month',
					`Every selected site already has a request for ${monthName} ${year}.`
				);
				return message(form, {
					type: 'error',
					text: `Every selected site already has a request for ${monthName} ${year}.`
				});
			}

			// `amount` is NOT NULL, and it is the figure the customer signed off on, so it
			// gets snapshotted at request time. Summed from the same contract rows the
			// invoice preview sums (deleted excluded, active or not) so the stored total
			// matches the document the user was looking at when they submitted.
			const amountBySite = new Map(
				await db
					.select({
						siteId: siteContracts.siteId,
						amount: sql<string>`COALESCE(SUM(${siteContracts.monthlyAmount}), 0)`
					})
					.from(siteContracts)
					.where(
						and(
							inArray(
								siteContracts.siteId,
								toRequest.map(({ siteId }) => siteId)
							),
							notDeleted(siteContracts)
						)
					)
					.groupBy(siteContracts.siteId)
					.then((rows) => rows.map((row) => [row.siteId, String(row.amount)] as const))
			);

			await db.transaction(async (tx) => {
				const insertable = toRequest.map(({ siteId, invoiceNumber }) => ({
					siteId,
					invoiceNumber,
					amount: amountBySite.get(siteId) ?? '0',
					vat: String(vat),
					withholding: String(withhold),
					requestDate: new Date(requestDate),
					requestedBy: requestor,
					month: monthName,
					year: Number(year),
					status: 'pending' as const
				}));

				await tx.insert(paymentRequest).values(insertable);
			});

			const skipped = new Set(contracts).size - toRequest.length;

			return message(form, {
				type: 'success',
				text: `${toRequest.length} request${toRequest.length === 1 ? '' : 's'} created for ${monthName} ${year}.${
					skipped
						? ` ${skipped} site${skipped === 1 ? '' : 's'} already had one and ${skipped === 1 ? 'was' : 'were'} skipped.`
						: ''
				}`
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
	}
};
