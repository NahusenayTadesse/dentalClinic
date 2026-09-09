import { db } from '$lib/server/db';
import { employee, department, site, deductions, position, salaries } from '$lib/server/db/schema';
import { eq, and, sql, between, inArray } from 'drizzle-orm';
import { notDeleted, softDeleteLookup } from '$lib/server/softDelete';
import { isApproved, unapprovedEmployeeIds } from '$lib/server/approvals';
import { requireSuperAdmin } from '$lib/server/permissions';
import { add, edit, deleteOvertime, bulkAdd } from './schema';
import type { PageServerLoad, Actions } from '../$types';
import { superValidate, message } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';

import { getMonthNumber, ethiopianRange, currentMonthFilter } from '$lib/global.svelte';
import { employeeLegalName } from '$lib/server/employeeName';

export const load: PageServerLoad = async ({ params }) => {
	const { range } = params;

	const form = await superValidate(zod4(bulkAdd));
	const [m, y] = range.split('_');
	const monthNumber = getMonthNumber(m);
	const year = Number(y);
	const { startDate, endDate } = ethiopianRange(monthNumber, year);

	// Helper to ensure 1 becomes "01", 3 becomes "03", etc.
	const pad = (n: number) => n.toString().padStart(2, '0');

	// Construct the strings manually to avoid JS Date string conversion
	const start = `${startDate.year}-${pad(startDate.month)}-${pad(startDate.day)}`;
	const end = `${endDate.year}-${pad(endDate.month)}-${pad(endDate.day)}`;

	// Now use these in your Drizzle query

	// 1. Get all employees with their departments
	const employees = await db
		.select({
			id: employee.id,
			name: employeeLegalName,
			department: department.name,
			position: position.name,
			site: site.name
		})
		.from(employee)
		.leftJoin(department, and(eq(department.id, employee.departmentId), notDeleted(department)))
		.leftJoin(position, and(eq(position.id, employee.positionId), notDeleted(position)))
		.leftJoin(site, and(eq(site.id, employee.siteId), notDeleted(site)))
		// Unapproved employees are not paid, so they collect no adjustments either.
		.where(and(eq(employee.isActive, true), isApproved(employee), notDeleted(employee)));

	// 2. Get all overtime records for the date range
	const overtimes = await db
		.select({
			id: deductions.id,
			staffId: deductions.staffId,
			date: sql<string>`DATE_FORMAT(${deductions.deductionDate}, '%Y-%m-%d')`,
			total: deductions.amount,
			reason: deductions.type,
			description: deductions.reason
		})
		.from(deductions)
		.where(and(between(deductions.deductionDate, start, end), notDeleted(deductions)));

	// 3. Merge them
	const staffList = employees.map((emp) => {
		const empOvertime = overtimes.filter((ot) => ot.staffId === emp.id);
		return {
			...emp,
			overtimeDetails: empOvertime,
			totalOvertimePay: empOvertime.reduce((sum, ot) => sum + (Number(ot.total) || 0), 0)
		};
	});

	return {
		staffList,
		form
	};
};

export const actions: Actions = {
	bulkAdd: async ({ request, cookies, params, locals }) => {
		const form = await superValidate(request, zod4(bulkAdd));
		console.log(form);

		if (!form.valid) {
			// Stay on the same page and set a flash message

			return message(
				form,
				{ type: 'error', text: 'Please check the form for errors' },
				{ status: 400 }
			);
		}

		const { ids, type, description, deductionDate, amount } = form.data;

		const blocked = await unapprovedEmployeeIds(ids);
		if (blocked.length > 0) {
			return message(
				form,
				{
					type: 'error',
					text: `${blocked.length} of the selected employees are not approved yet. Reload the page and try again.`
				},
				{ status: 400 }
			);
		}

		console.log(ids.length);

		try {
			await db.transaction(async (tx) => {
				const deductionEntries = ids.map((staffId) => ({
					staffId,
					type,
					reason: description,
					deductionDate,
					amount,
					createdBy: locals.user?.id
				}));

				// 2. Perform the bulk insert
				await tx.insert(deductions).values(deductionEntries);
			});

			return message(form, {
				type: 'success',
				text: `Deduction Successuflly for ${ids.length} Employees Added`
			});
		} catch (err) {
			return message(
				form,
				{
					type: 'error',
					text: 'An Error occured while adding Deduction' + err?.message
				},
				{ status: 500 }
			);
		}
	},
	add: async ({ request, cookies, params, locals }) => {
		const form = await superValidate(request, zod4(add));
		console.log(form);
		if (!form.valid) {
			// Stay on the same page and set a flash message

			return message(
				form,
				{ type: 'error', text: 'Please check the form for errors' },
				{ status: 400 }
			);
		}

		const { staffId, type, description, deductionDate, amount } = form.data;

		if ((await unapprovedEmployeeIds([staffId])).length > 0) {
			return message(
				form,
				{
					type: 'error',
					text: 'That employee is not approved yet, so nothing can be recorded for them.'
				},
				{ status: 400 }
			);
		}

		try {
			await db.transaction(async (tx) => {
				await tx.insert(deductions).values({
					staffId,
					type,
					reason: description,
					deductionDate,
					amount,

					createdBy: locals.user?.id
				});
			});

			return message(form, { type: 'success', text: 'Deduction Successuflly Added' });
		} catch (err) {
			return message(
				form,
				{
					type: 'error',
					text: 'An Error occured while adding Deduction' + err?.message
				},
				{ status: 500 }
			);
		}
	},
	edit: async ({ request, cookies, params, locals }) => {
		const form = await superValidate(request, zod4(edit));

		if (!form.valid) {
			// Stay on the same page and set a flash message

			return message(
				form,
				{ type: 'error', text: 'Please check the form for errors' },
				{ status: 400 }
			);
		}

		const { id, staffId, type, description, deductionDate, amount } = form.data;

		try {
			await db.transaction(async (tx) => {
				// const rate = await tx
				// 	.select({
				// 		rate: overTimeType.rate
				// 	})
				// 	.from(overTimeType)
				// 	.where(eq(overTimeType.id, overtimeType))
				// 	.then((rows) => rows[0]);
				// const basicSalary = await tx
				// 	.select({
				// 		salary: salaries.amount
				// 	})
				// 	.from(salaries)
				// 	.where(eq(salaries.staffId, staffId))
				// 	.then((rows) => rows[0]);

				// const total = (Number(basicSalary.salary) / 192) * (hours * Number(rate.rate));
				await tx
					.update(deductions)
					.set({
						type,
						reason: description,
						deductionDate,
						amount,
						updatedBy: locals.user?.id
					})
					.where(eq(deductions.id, Number(id)));
			});
			return message(form, { type: 'success', text: 'Deductions Successuflly Updated' });
		} catch (err) {
			return message(
				form,
				{
					type: 'error',
					text: 'An Error occured while updating Deductions' + err?.message
				},
				{ status: 500 }
			);
		}
	},

	delete: async ({ request, cookies, params, locals }) => {
		// Outside the try on purpose: `requireSuperAdmin` throws a 403, and a
		// catch below would swallow it into a plain error message.
		requireSuperAdmin(locals);

		const form = await superValidate(request, zod4(deleteOvertime));

		if (!form.valid) {
			// Stay on the same page and set a flash message

			return message(
				form,
				{ type: 'error', text: 'Please check the form for errors' },
				{ status: 400 }
			);
		}

		const { id } = form.data;

		try {
			const deleted = await db.transaction(async (tx) =>
				softDeleteLookup(tx, deductions, Number(id), locals.user?.id)
			);

			if (!deleted) {
				return message(form, { type: 'error', text: 'That entry was not found' }, { status: 404 });
			}

			return message(form, { type: 'success', text: 'Deductions Successuflly Deleted' });
		} catch (err) {
			return message(
				form,
				{
					type: 'error',
					text: 'An Error occured while deleting Deductions' + err?.message
				},
				{ status: 500 }
			);
		}
	}
};
