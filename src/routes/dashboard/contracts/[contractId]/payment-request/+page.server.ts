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
	employeeTermination
} from '$lib/server/db/schema';
import { eq, and, isNull, sql, desc } from 'drizzle-orm';
import { notDeleted } from '$lib/server/softDelete';
import type { PageServerLoad, Actions } from '../$types';

import { superValidate } from 'sveltekit-superforms';
import { error } from '@sveltejs/kit';
import { fail, message } from 'sveltekit-superforms';
import { subcities, service, customerList } from '$lib/server/fastData';

export const load: PageServerLoad = async ({ params, locals }) => {
	const { contractId } = params;

	let contracts = await db
		.select({
			id: siteContracts.id,
			siteName: site.name,
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
		.where(
			and(eq(siteMonthlyPayments.contractId, Number(contractId)), notDeleted(siteMonthlyPayments))
		)
		.orderBy(desc(siteMonthlyPayments.date));

	const employees = await db
		.select({
			value: employee.id,
			name: sql<string>`CONCAT(${employee.name}, ' ', ${employee.fatherName})`,
			signiture: employee.signiture
		})
		.from(employee)
		.leftJoin(
			employmentStatuses,
			and(eq(employmentStatuses.id, employee.employmentStatus), notDeleted(employmentStatuses))
		)
		.leftJoin(employeeTermination, eq(employeeTermination.staffId, employee.id))
		.where(
			and(
				eq(employee.isActive, true),
				eq(employmentStatuses.removeFromLists, false),
				isNull(employeeTermination.staffId),
				eq(employee.departmentId, 8),
				notDeleted(employee)
			)
		);

	const vats = await db
		.select()
		.from(vatAndWithHold)
		.then((rows) => rows[0]);

	return {
		payments,
		employees,
		serviceList,
		contracts,
		vats
	};
};
