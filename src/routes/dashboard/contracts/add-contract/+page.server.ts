import { zod4 } from 'sveltekit-superforms/adapters';
import { db } from '$lib/server/db';
import { site, siteContracts, employee } from '$lib/server/db/schema';
import { asRequested } from '$lib/server/approvals';
import { eq, and, sql } from 'drizzle-orm';
import { notDeleted } from '$lib/server/softDelete';
import type { PageServerLoad } from '../$types';
import { superValidate } from 'sveltekit-superforms';
import { type Actions } from '@sveltejs/kit';
import { message } from 'sveltekit-superforms';

import { service } from '$lib/server/fastData';

import { addContract, editContract } from './schema';
import { saveUploadedFile } from '$lib/server/upload';

export const load: PageServerLoad = async ({ params, locals }) => {
	const form = await superValidate(zod4(addContract));

	const serviceList = await service();

	const siteList = await db
		.select({
			value: site.id,
			name: site.name
		})
		.from(site)
		.where(and(eq(site.isActive, true), notDeleted(site)));

	const employeeList = await db
		.select({
			value: employee.id,
			name: sql<string>`TRIM(CONCAT(COALESCE(${employee.name}, ''), ' ', COALESCE(${employee.fatherName}, '')))`
		})
		.from(employee)
		.where(and(eq(employee.departmentId, 8), eq(employee.isActive, true), notDeleted(employee)));

	return {
		siteList,
		serviceList,
		form,
		employeeList
	};
};

export const actions: Actions = {
	addContract: async ({ request, locals }) => {
		const form = await superValidate(request, zod4(addContract));

		if (!form.valid) {
			return message(form, { type: 'error', text: `Error: check the form` });
		}

		const {
			site,
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
					siteId: site,
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
