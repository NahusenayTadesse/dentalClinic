import { zod4 } from 'sveltekit-superforms/adapters';
import { editCustomer } from '$lib/ZodSchema';
import { db } from '$lib/server/db';
import {
	customers,
	address,
	siteMonthlyPayments,
	user,
	services,
	site,
	contractRenewals,
	employee,
	siteContracts,
	siteContacts
} from '$lib/server/db/schema';
import { asRequested, isApproved } from '$lib/server/approvals';
import type { PageServerLoad } from '../$types';
import { superValidate } from 'sveltekit-superforms';
import { error, type Actions } from '@sveltejs/kit';
import { fail, message } from 'sveltekit-superforms';
import { setFlash } from 'sveltekit-flash-message/server';

import { subcities, service, customerList } from '$lib/server/fastData';

import {
	editDetail,
	editAddress,
	addContact,
	editContact,
	addContract,
	editContract,
	addSites,
	editSites
} from './schema';
import { saveUploadedFile } from '$lib/server/upload';
import { and, eq, or, like, count, sql, desc } from 'drizzle-orm';
import { parseTableQuery, buildWhere, pagination, currentQuery } from '$lib/server/queryFilters';
import { notDeleted } from '$lib/server/softDelete';

export const load: PageServerLoad = async ({ url }) => {
	const detailForm = await superValidate(zod4(editDetail));
	const addressForm = await superValidate(zod4(editAddress));
	const addContactForm = await superValidate(zod4(addContact));
	const editContactForm = await superValidate(zod4(editContact));
	const addContractForm = await superValidate(zod4(addContract));
	const editContractForm = await superValidate(zod4(editContract));
	const editSiteForm = await superValidate(zod4(editSites));
	const addSiteForm = await superValidate(zod4(addSites));

	const subcityList = await subcities();
	const serviceList = await service();

	// --- QueryBuilder params ---
	const query = parseTableQuery(url, [
		'serviceId',
		'signingOfficerId',
		'contractYear',
		'commission'
	]);

	const whereClause = buildWhere(query, {
		base: [
			eq(siteContracts.isActive, true),
			eq(siteContracts.terminated, false),
			notDeleted(siteContracts),
			// Only approved contracts belong in the main list.
			isApproved(siteContracts)!
		],
		search: (term) => or(like(site.name, `%${term}%`), like(services.name, `%${term}%`)),
		// The date range narrows on contractDate — the signed date.
		dateColumn: siteContracts.contractDate,
		filters: {
			serviceId: (v) => eq(siteContracts.serviceId, Number(v)),
			signingOfficerId: (v) => eq(siteContracts.signingOfficer, Number(v)),
			contractYear: (v) => eq(siteContracts.contractYear, Number(v)),
			// 'true' | 'false'
			commission: (v) =>
				v === 'true' || v === 'false'
					? eq(siteContracts.commissionConsidered, v === 'true')
					: undefined
		}
	});

	// --- Filter option lists ---
	const [signingOfficerOptions, contractYearOptions] = await Promise.all([
		db
			.select({
				id: employee.id,
				name: sql<string>`CONCAT(${employee.name}, ' ', ${employee.fatherName})`
			})
			.from(employee)
			.where(
				and(
					sql`${employee.id} IN (SELECT DISTINCT signing_officer FROM ${siteContracts} WHERE ${siteContracts.deletedAt} IS NULL)`,
					notDeleted(employee)
				)
			),
		db
			.selectDistinct({ year: siteContracts.contractYear })
			.from(siteContracts)
			.where(notDeleted(siteContracts))
			.orderBy(desc(siteContracts.contractYear))
	]);

	// --- Total count (needs the same joins the WHERE depends on) ---
	const [{ total }] = await db
		.select({ total: count() })
		.from(siteContracts)
		.leftJoin(services, and(eq(siteContracts.serviceId, services.id), notDeleted(services)))
		.leftJoin(site, and(eq(siteContracts.siteId, site.id), notDeleted(site)))
		.where(whereClause);

	// --- Main paginated + filtered query ---
	let contracts = await db
		.select({
			id: siteContracts.id,
			service: services.name,
			site: site.name,
			siteId: siteContracts.siteId,
			serviceId: siteContracts.serviceId,
			startDate: siteContracts.startDate,
			endDate: siteContracts.endDate,
			totalMonths: sql<number>`TIMESTAMPDIFF(MONTH, ${siteContracts.startDate}, ${siteContracts.endDate})`,
			daysRemaining: sql<number>`DATEDIFF(${siteContracts.endDate}, NOW())`,
			monthlyAmount: siteContracts.monthlyAmount,
			contractYear: siteContracts.contractYear,
			signedDate: siteContracts.contractDate,
			contractFile: siteContracts.contractFile,
			officeCommission: siteContracts.commissionConsidered,
			status: siteContracts.isActive,
			signingOfficer: siteContracts.signingOfficer,
			signingOfficerName: sql<string>`CONCAT(${employee.name}, ' ', ${employee.fatherName})`,
			addedBy: user.name,
			addedById: user.id,
			numberOfRenewals: count(contractRenewals.id),
			expectedPayments: sql<number>`
				GREATEST(0,
					(PERIOD_DIFF(
						EXTRACT(YEAR_MONTH FROM ${siteContracts.endDate}),
						EXTRACT(YEAR_MONTH FROM ${siteContracts.startDate})
					) + 1) - COUNT(${siteMonthlyPayments.id})
				)`,
			actualPayments: sql<number>`
				(SELECT COUNT(*)
				 FROM ${siteMonthlyPayments}
				 WHERE ${siteMonthlyPayments.contractId} = ${siteContracts.id})
			`.as('actual'),
			missingPayments: sql<number>`
				(SELECT GREATEST(0,
					(PERIOD_DIFF(
						EXTRACT(YEAR_MONTH FROM LEAST(${siteContracts.endDate}, CURDATE())),
						EXTRACT(YEAR_MONTH FROM ${siteContracts.startDate})
					) + 1) - COUNT(*)
				) FROM ${siteMonthlyPayments}
				  WHERE ${siteMonthlyPayments.contractId} = ${siteContracts.id})
			`.as('missing')
		})
		.from(siteContracts)
		.leftJoin(services, and(eq(siteContracts.serviceId, services.id), notDeleted(services)))
		.leftJoin(site, and(eq(siteContracts.siteId, site.id), notDeleted(site)))
		.leftJoin(user, eq(siteContracts.createdBy, user.id))
		.leftJoin(employee, and(eq(siteContracts.signingOfficer, employee.id), notDeleted(employee)))
		.leftJoin(
			contractRenewals,
			and(eq(siteContracts.id, contractRenewals.contractId), notDeleted(contractRenewals))
		)
		.leftJoin(
			siteMonthlyPayments,
			and(eq(siteContracts.id, siteMonthlyPayments.contractId), notDeleted(siteMonthlyPayments))
		)
		.where(whereClause)
		.groupBy(
			siteContracts.id,
			services.name,
			site.name,
			user.name,
			user.id,
			employee.name,
			employee.fatherName
		)
		.orderBy(desc(siteContracts.contractDate))
		.limit(query.limit)
		.offset(query.offset);

	// --- Urgent contracts: separate, unpaginated, unfiltered by QueryBuilder state ---
	// Always reflects the whole active/non-terminated dataset, regardless of search/page.
	const urgentContracts = await db
		.select({
			id: siteContracts.id,
			service: services.name,
			site: site.name,
			endDate: siteContracts.endDate,
			daysRemaining: sql<number>`DATEDIFF(${siteContracts.endDate}, NOW())`
		})
		.from(siteContracts)
		.leftJoin(services, and(eq(siteContracts.serviceId, services.id), notDeleted(services)))
		.leftJoin(site, and(eq(siteContracts.siteId, site.id), notDeleted(site)))
		.where(
			and(
				eq(siteContracts.isActive, true),
				eq(siteContracts.terminated, false),
				notDeleted(siteContracts)
			)
		)
		.having(sql`DATEDIFF(${siteContracts.endDate}, NOW()) < 30`)
		.orderBy(sql`DATEDIFF(${siteContracts.endDate}, NOW()) ASC`);

	return {
		detailForm,
		addressForm,
		subcityList,
		addContactForm,
		editContactForm,
		addContractForm,
		editContractForm,
		contracts,
		urgentContracts,
		serviceList,
		editSiteForm,
		addSiteForm,
		pagination: pagination(query, total),
		filterOptions: {
			services: serviceList,
			signingOfficers: signingOfficerOptions,
			contractYears: contractYearOptions.map((c) => c.year)
		},
		currentQuery: currentQuery(query)
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
		const { name, phone, status, officeCommission, customer } = form.data;

		try {
			await db
				.update(site)
				.set({
					name,
					phone,
					customerId: customer,
					isActive: status,
					officeCommission,
					updatedBy: locals?.user?.id
				})
				.where(eq(site.id, Number(id)));

			// Stay on the same page and set a flash message
			return message(form, { type: 'success', text: 'Site updated Successfully Added' });
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
						floor: Number(floor),
						houseNumber: Number(houseNumber),
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
				await tx.insert(siteContacts).values({
					siteId: Number(id),
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
					.update(siteContacts)
					.set({
						contactDetail,
						contactType,
						isActive: status,
						updatedBy: locals?.user?.id
					})
					.where(eq(siteContacts.id, id));

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

	editSite: async ({ request, locals }) => {
		const form = await superValidate(request, zod4(editSites));

		if (!form.valid) {
			return message(form, { type: 'error', text: `Error: check the form` });
		}

		const { id, name, phone, startDate, endDate, status } = form.data;

		try {
			await db.transaction(async (tx) => {
				await tx
					.update(site)
					.set({
						name,
						phone,
						startDate: new Date(startDate),
						endDate: new Date(endDate),
						isActive: status,
						updatedBy: locals?.user?.id
					})
					.where(eq(site.id, id));

				return message(form, {
					type: 'success',
					text: 'Site Details Updated Successfully!'
				});
			});
		} catch (err) {
			return message(form, {
				type: 'error',
				text: `Updated failed: ${err instanceof Error ? err.message : 'Unknown error'}`
			});
		}
	},
	addContract: async ({ request, locals, params }) => {
		const { id } = params;
		const form = await superValidate(request, zod4(addContract));

		if (!form.valid) {
			return message(form, { type: 'error', text: `Error: check the form` });
		}

		const {
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
				const contractFileName = await saveUploadedFile(contractFile);
				await tx.insert(siteContracts).values({
					...asRequested(locals?.user?.id),
					siteId: Number(id),
					serviceId: service,
					contractDate,
					contractYear,
					startDate,
					endDate,
					contractFile: contractFileName,
					monthlyAmount,
					isActive: status,
					commissionConsidered,
					signingOfficer,
					createdBy: locals?.user?.id
				});

				return message(form, {
					type: 'success',
					text: 'Contract Added Successfully!'
				});
			});
		} catch (err) {
			console.error(err?.message);
			return message(form, {
				type: 'error',
				text: `Adding Site failed: ${err instanceof Error ? err.message : 'Unknown error'}`
			});
		}
	},
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
