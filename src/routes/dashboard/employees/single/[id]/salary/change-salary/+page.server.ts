import { superValidate, message, setError } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { salaryChangeSchema as schema } from './schema';

import { db } from '$lib/server/db';
import { employee, officeWorkerCommission, salaries } from '$lib/server/db/schema';
import { asRequested } from '$lib/server/approvals';
import type { Actions, PageServerLoad } from './$types';
import { setFlash } from 'sveltekit-flash-message/server';
import { and, eq, isNull } from 'drizzle-orm';
import { sites, departments, positions } from '$lib/server/fastData';
export const load: PageServerLoad = async ({ parent }) => {
	const { staffMember } = await parent();
	const form = await superValidate(
		{
			site: staffMember?.siteId,
			department: staffMember?.departmentId,
			position: staffMember?.positionId
		},
		zod4(schema)
	);

	return {
		form,
		sites: await sites(),
		departments: await departments(),
		positions: await positions()
	};
};

export const actions: Actions = {
	changeSalary: async ({ request, cookies, params, locals }) => {
		const { id } = params;
		const form = await superValidate(request, zod4(schema));

		if (!form.valid) {
			return message(
				form,
				{ type: 'error', message: 'Please check your form data.' },
				{ status: 400 }
			);
		}

		const {
			site,
			department,
			position,
			amount,
			transportationAllowance,
			nonTaxAllowance,
			positionAllowance,
			housingAllowance,
			officeCommission,
			percentage,
			date
		} = form.data;

		try {
			let errorMessage;
			await db.transaction(async (tx) => {
				const today = new Date(date);
				const yesterday = new Date(today);
				yesterday.setDate(today.getDate() - 1);

				function isThirtyDaysOlder(date: Date | string) {
					const targetDate = new Date(date);
					const today = new Date();

					// Create a cutoff date by subtracting 30 days from today
					const thirtyDaysAgo = new Date();
					thirtyDaysAgo.setDate(today.getDate() - 30);

					// Compare the target date to the cutoff
					// If targetDate is <= thirtyDaysAgo, it's at least 30 days old
					return targetDate <= thirtyDaysAgo;
				}

				if (isThirtyDaysOlder(date)) {
					setError(form, 'date', 'Date must be 30 days old or sooner');
					errorMessage = message(form, {
						type: 'error',
						text: 'Date must be 30 days old or sooner'
					});
				}

				// The previous salary is deliberately left open here. The new row goes in pending, and
				// until someone approves it the employee must keep earning at the old rate — payroll
				// pro-rates from open rows, so closing this now would pay them nothing in the gap.
				// The old row is closed by the salaries `onApprove` hook in $lib/server/approvals.

				await tx.insert(salaries).values({
					...asRequested(locals.user?.id),
					staffId: Number(id),
					departmentId: department,
					officeCommission,
					percentage,
					siteId: site,
					positionId: position,
					amount,
					transportationAllowance,
					nonTaxAllowance,
					positionAllowance,
					housingAllowance,
					startDate: today,
					createdBy: locals.user?.id
				});

				await tx
					.update(employee)
					.set({
						departmentId: department,
						siteId: site,
						positionId: position
					})
					.where(eq(employee.id, Number(id)));

				// if (officeCommission) {
				// 	const [existingCom] = await db
				// 		.select({ id: officeWorkerCommission.id })
				// 		.from(officeWorkerCommission)
				// 		.where(eq(officeWorkerCommission.staffId, Number(id)))
				// 		.limit(1);

				// 	if (existingCom)
				// 		await tx
				// 			.update(officeWorkerCommission)
				// 			.set({
				// 				percentage,
				// 				createdBy: locals.user?.id
				// 			})
				// 			.where(eq(officeWorkerCommission.id, existingCom.id));
				// 	else {
				// 		await tx.insert(officeWorkerCommission).values({
				// 			staffId: Number(id),
				// 			percentage,
				// 			createdBy: locals.user?.id
				// 		});
				// 	}
				// }
				//
				if (officeCommission) {
					await tx
						.insert(officeWorkerCommission)
						.values({
							staffId: Number(id),
							percentage,
							createdBy: locals.user?.id
						})
						.onDuplicateKeyUpdate({
							set: {
								percentage,
								updatedBy: locals.user?.id
							}
						});
				}
			});
			if (errorMessage) return errorMessage;
			setFlash({ type: 'success', message: 'New Salary Successuflly Changed' }, cookies);
			return message(form, { type: 'success', text: 'New Salary Successfully Changed' });
		} catch (err) {
			setFlash(
				{ type: 'error', message: 'An Error occured while changing Salary' + err.message },
				cookies
			);

			console.error(err);

			return message(
				form,
				{
					type: 'error',
					text: 'An Error occured while changing Salary' + err.message
				},
				{
					status: 500
				}
			);
		}
	}
};
