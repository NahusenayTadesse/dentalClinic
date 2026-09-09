import { zod4 } from 'sveltekit-superforms/adapters';
import { editCustomer } from '$lib/ZodSchema';
import { db } from '$lib/server/db';
import {
	transactions,
	siteMonthlyPayments,
	user,
	services,
	employee,
	contractRenewals,
	siteContracts,
	paymentMethods,
	employmentStatuses,
	site,
	customers,
	address,
	subcity,
	employeeTermination
} from '$lib/server/db/schema';
import { eq, desc, sql, isNull, and, getTableColumns } from 'drizzle-orm';
import { notDeleted, softDeleteOwnedRecord } from '$lib/server/softDelete';
import { requireSuperAdmin } from '$lib/server/permissions';
import { setFlash } from 'sveltekit-flash-message/server';
import type { PageServerLoad, Actions } from '../$types';

import { setError, superValidate } from 'sveltekit-superforms';
import { error } from '@sveltejs/kit';
import { fail, message } from 'sveltekit-superforms';
import { editContract, renewContract } from './schema';
import { subcities, service, customerList, sites } from '$lib/server/fastData';

export const load: PageServerLoad = async ({ params, locals }) => {
	const { contractId } = params;

	const form = await superValidate(zod4(editContract));
	const renewForm = await superValidate(zod4(renewContract));

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

		const siteList = await sites();

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
			site: siteContracts.siteId,
			siteName: site.name,
			sitePhone: site.phone,
			siteStartDate: site.startDate,
			siteOfficeCommission: site.officeCommission,
			siteStatus: site.isActive,
			customerId: site.customerId,
			customerName: customers.name,
			siteSubcity: subcity.name,
			siteStreet: address.street,
			siteKebele: address.kebele,
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
			terminated: siteContracts.terminated,
			terminationReason: siteContracts.terminationReason,
			inActiveReason: siteContracts.inActiveReason,
			terminationDate: siteContracts.terminationDate,

			addedBy: user.name,
			addedById: user.id
		})
		.from(siteContracts)
		.leftJoin(services, and(eq(siteContracts.serviceId, services.id), notDeleted(services)))
		.leftJoin(site, and(eq(siteContracts.siteId, site.id), notDeleted(site)))
		.leftJoin(customers, and(eq(site.customerId, customers.id), notDeleted(customers)))
		.leftJoin(address, eq(site.address, address.id))
		.leftJoin(subcity, eq(address.subcityId, subcity.id))
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
			requestChangeReason: siteMonthlyPayments.requestChangeReason,
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

	const renewalHistory = await db
		.select({
			...getTableColumns(contractRenewals),
			signingOfficerName: sql<string>`CONCAT(${employee.name}, ' ', ${employee.fatherName})`,
			addedBy: user.name
		})
		.from(contractRenewals)
		.leftJoin(employee, and(eq(contractRenewals.signingOfficer, employee.id), notDeleted(employee)))
		.leftJoin(user, eq(contractRenewals.createdBy, user.id))
		.where(and(eq(contractRenewals.contractId, Number(contractId)), notDeleted(contractRenewals)));

	return {
		payments,
		serviceList,
		contracts,
		employees,
		form,
		renewForm,
		siteList,
		renewalHistory
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
			site,
			contractDate,
			contractYear,
			startDate,
			endDate,
			contractFile,
			monthlyAmount,
			status,
			commissionConsidered,
			signingOfficer,
			terminated,
			terminationReason,
			terminationDate,
			inActiveReason
		} = form.data;

		if (status === false && inActiveReason === undefined) {
			setError(form, 'inActiveReason', 'Inactive reason is required when status is false');
			return message(form, {
				type: 'error',
				text: `Error: Inactive reason is required when contract is not active`
			});
		}

		if (
			inActiveReason?.trim() === 'Automatic Expiration of Contract By System' &&
			status === false
		) {
			setError(
				form,
				'inActiveReason',
				'InActive Reason can not be the same as Automatic Expiration of Contract By System'
			);
			return message(form, {
				type: 'error',
				text: `Error: InActive Reason can not be the same as Automatic Expiration of Contract By System`
			});
		}

		if (terminated === true && terminationReason === undefined) {
			setError(form, 'terminationReason', 'Termination reason is required when terminated is true');
			return message(form, {
				type: 'error',
				text: `Error: Termination Reason is required when contract is terminated`
			});
		}

		if (terminated === true && terminationDate === undefined) {
			setError(form, 'terminationDate', 'Termination date is required when terminated is true');
			return message(form, {
				type: 'error',
				text: `Error: Termination Date is required when contract is terminated`
			});
		}

		try {
			await db.transaction(async (tx) => {
				if (contractFile) {
					const contractFileName = await saveUploadedFile(contractFile);

					await tx
						.update(siteContracts)
						.set({
							serviceId: service,
							siteId: site,
							contractDate: new Date(contractDate),
							contractYear,
							startDate: new Date(startDate),
							endDate: new Date(endDate),
							contractFile: contractFileName,
							monthlyAmount: String(monthlyAmount),
							isActive: status,
							commissionConsidered,
							signingOfficer,
							terminated,
							terminationReason,
							inActiveReason,
							terminationDate: terminationDate ? new Date(terminationDate) : null,
							updatedBy: locals?.user?.id
						})
						.where(eq(siteContracts.id, id));
				} else {
					await tx
						.update(siteContracts)
						.set({
							serviceId: service,
							siteId: site,
							contractDate: new Date(contractDate),
							contractYear,
							startDate: new Date(startDate),
							endDate: new Date(endDate),
							monthlyAmount: String(monthlyAmount),
							isActive: status,
							commissionConsidered,
							signingOfficer,
							terminated,
							terminationReason,
							inActiveReason,
							terminationDate: terminationDate ? new Date(terminationDate) : null,
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
	},
	renewContract: async ({ request, locals, params }) => {
		const form = await superValidate(request, zod4(renewContract));
		if (!form.valid) {
			return message(
				form,
				{
					type: 'error',
					text: 'Please Check the form value'
				},
				{ status: 400 }
			);
		}
		const { contractId } = params;

		const {
			renewalDate,
			renewalStartDate,
			renewalEndDate,
			renewalAmount,
			signingOfficer,
			contractFile
		} = form.data;

		function validateRenewalDates(startDate: string, endDate: string) {
			// 1. Check if dates exist
			if (!startDate || !endDate) {
				return { isValid: false, message: 'Both start and end dates are required.' };
			}

			// Convert to Date objects and strip time for pure date comparison
			const start = new Date(startDate);
			const end = new Date(endDate);

			if (end < start) {
				return { isValid: false, message: 'End date cannot be before the start date.' };
			}

			// 3. Check if they are on the exact same day
			if (start.getTime() === end.getTime()) {
				return { isValid: false, message: 'Start date and end date cannot be the same day.' };
			}

			// If all checks pass
			return { isValid: true, message: 'Dates are valid.' };
		}

		if (!validateRenewalDates(renewalStartDate, renewalEndDate).isValid) {
			setError(
				form,
				'renewalStartDate',
				validateRenewalDates(renewalStartDate, renewalEndDate).message
			);
			setError(
				form,
				'renewalEndDate',
				validateRenewalDates(renewalStartDate, renewalEndDate).message
			);
			return message(form, {
				type: 'error',
				text: validateRenewalDates(renewalStartDate, renewalEndDate).message
			});
		}

		try {
			const contractLink = contractFile ? await saveUploadedFile(contractFile) : undefined;

			await db.transaction(async (tx) => {
				await tx
					.update(siteContracts)
					.set({
						startDate: new Date(renewalStartDate),
						endDate: new Date(renewalEndDate),
						monthlyAmount: String(renewalAmount),
						updatedBy: locals?.user?.id,
						terminated: false,
						isActive: true
					})
					.where(eq(siteContracts.id, Number(contractId)));

				await tx.insert(contractRenewals).values({
					contractId: Number(contractId),
					renewalDate,
					renewalStartDate,
					renewalEndDate,
					renewalAmount,
					signingOfficer,
					contractFile: contractLink,
					createdBy: locals?.user?.id
				});
			});
		} catch (err) {
			console.error('Error: ', err);
			return message(form, { type: 'error', text: 'Unexpected Error ' + err.message });
		}
	},

	/**
	 * Soft delete of one renewal. Super admin only — `requireSuperAdmin` throws
	 * 403 rather than failing quietly, because the hidden button is UX, not
	 * access control.
	 */
	deleteRenewal: async ({ request, params, locals, cookies }) => {
		requireSuperAdmin(locals);

		const data = await request.formData();
		const renewalId = Number(data.get('id'));

		if (!renewalId) {
			setFlash({ type: 'error', message: 'No renewal was selected.' }, cookies);
			return fail(400);
		}

		try {
			const deleted = await db.transaction(async (tx) =>
				softDeleteOwnedRecord(
					tx,
					contractRenewals,
					contractRenewals.contractId,
					renewalId,
					Number(params.contractId),
					locals.user?.id
				)
			);

			if (!deleted) {
				// Either already gone, or the id belongs to a different contract.
				setFlash({ type: 'error', message: 'That renewal was not found.' }, cookies);
				return fail(404);
			}
		} catch (err) {
			console.error('Error deleting renewal:', err);
			setFlash(
				{
					type: 'error',
					message: `Could not delete renewal: ${err instanceof Error ? err.message : 'Unknown error'}`
				},
				cookies
			);
			return fail(500);
		}

		setFlash({ type: 'success', message: 'Renewal deleted.' }, cookies);
		return { success: true };
	}
};
