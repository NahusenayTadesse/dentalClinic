import { db } from '$lib/server/db';
import {
	employee,
	department,
	overTimeType,
	site,
	overTime,
	position,
	salaries
} from '$lib/server/db/schema';
import { eq, sql, between, inArray, and } from 'drizzle-orm';
import { notDeleted, softDeleteLookup } from '$lib/server/softDelete';
import { isApproved, unapprovedEmployeeIds } from '$lib/server/approvals';
import { requireSuperAdmin } from '$lib/server/permissions';
import { add, edit, deleteOvertime, bulkAdd } from './schema';
import type { PageServerLoad, Actions } from './$types';
import { superValidate, setError, message } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { overtimeTypes } from '$lib/server/fastData';

import { getMonthNumber, ethiopianRange, currentMonthFilter } from '$lib/global.svelte';
import { employeeLegalName } from '$lib/server/employeeName';

export const load: PageServerLoad = async ({ params }) => {
	const { range } = params;

	const { id } = params;

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

	console.log('Start:', start, typeof start); // Should be: 2026-03-10 string
	console.log('End:', end, typeof end); // Should be: 2026-04-08 string
	console.log('endDate object:', endDate); // Check if this is a JS Date

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
		.where(
			and(
				eq(employee.isActive, true),
				eq(employee.siteId, Number(id)),
				isApproved(employee),
				notDeleted(employee)
			)
		);

	// 2. Get all overtime records for the date range
	const overtimes = await db
		.select({
			id: overTime.id,
			staffId: overTime.staffId,
			date: sql<string>`DATE_FORMAT(${overTime.date}, '%Y-%m-%d')`,
			overtimeType: overTimeType.name,
			overtimeTypeId: overTimeType.id,
			hours: overTime.hours,
			total: overTime.total,
			reason: overTime.reason
		})
		.from(overTime)
		.leftJoin(overTimeType, eq(overTimeType.id, overTime.overTimeTypeId))
		.where(and(between(overTime.date, start, end), notDeleted(overTime)));

	const types = await overtimeTypes();

	// 3. Merge them
	const staffList = employees.map((emp) => {
		const empOvertime = overtimes.filter((ot) => ot.staffId === emp.id);
		return {
			...emp,
			overtimeDetails: empOvertime,
			overtimeTypes: types,
			totalOvertimeHours: empOvertime.reduce((sum, ot) => sum + (Number(ot.hours) || 0), 0),
			totalOvertimePay: empOvertime.reduce((sum, ot) => sum + (Number(ot.total) || 0), 0)
		};
	});

	return {
		staffList,
		form,
		types
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

		const { ids, reason, date, overtimeType, hours } = form.data;

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

		const rateRow = await db
			.select({
				rate: overTimeType.rate,
				name: overTimeType.name,
				maxHours: overTimeType.maxhours
			})
			.from(overTimeType)
			.where(eq(overTimeType.id, overtimeType))
			.then((rows) => rows[0]);

		console.log(hours > Number(rateRow?.maxHours) && rateRow?.maxHours !== null);

		if (hours > Number(rateRow?.maxHours) && rateRow?.maxHours !== null) {
			setError(form, 'hours', `Hours exceed maximum allowed (${rateRow.maxHours})`);
			return message(form, {
				type: 'error',
				text: `Hours exceed maximum allowed (${rateRow.maxHours})`
			});
		}

		if (!rateRow) return message(form, { type: 'error', text: 'Overtime type not found' });

		console.log(ids.length);

		try {
			let errorResponse;
			await db.transaction(async (tx) => {
				// 1. Fetch the rate (Shared across all entries)
				//

				// 2. Fetch salaries for ALL provided IDs
				// It's much faster to fetch them all in one query than inside a loop
				const staffSalaries = await tx
					.select({
						salary: salaries.amount,
						staffId: salaries.staffId
					})
					.from(salaries)
					.where(inArray(salaries.staffId, ids));

				// 3. Map the data into an array of insert objects
				const insertData = staffSalaries.map((staff) => {
					const hourlyRate = Number(staff.salary) / 192;
					const total = hourlyRate * (hours * Number(rateRow.rate));

					return {
						staffId: staff.staffId,
						overTimeTypeId: overtimeType,
						hours,
						total, // Ensuring decimal precision
						reason,
						date,
						createdBy: locals.user?.id
					};
				});

				// 4. Perform the bulk insert
				if (insertData.length > 0) {
					await tx.insert(overTime).values(insertData);
				}
			});

			if (errorResponse) return errorResponse;

			return message(form, {
				type: 'success',
				text: `Overtime Successuflly for ${ids.length} Employees Added`
			});
		} catch (err) {
			return message(
				form,
				{
					type: 'error',
					text: 'An Error occured while adding Overtime' + err?.message
				},
				{ status: 500 }
			);
		}
	},
	add: async ({ request, cookies, params, locals }) => {
		const form = await superValidate(request, zod4(add));

		if (!form.valid) {
			// Stay on the same page and set a flash message

			return message(
				form,
				{ type: 'error', text: 'Please check the form for errors' },
				{ status: 400 }
			);
		}

		const { staffId, reason, date, overtimeType, hours } = form.data;

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
			let errorResponse;
			await db.transaction(async (tx) => {
				const rate = await tx
					.select({
						rate: overTimeType.rate,
						name: overTimeType.name,
						maxHours: overTimeType.maxhours
					})
					.from(overTimeType)
					.where(eq(overTimeType.id, overtimeType))
					.then((rows) => rows[0]);

				console.log(hours > Number(rate?.maxHours) && rate?.maxHours !== null);

				if (!rate)
					errorResponse = message(form, { type: 'error', text: 'Overtime type not found' });

				if (hours > Number(rate?.maxHours) && rate?.maxHours !== null) {
					setError(form, 'hours', `Hours exceed maximum allowed (${rate.maxHours})`);
					errorResponse = message(form, {
						type: 'error',
						text: `Hours exceed maximum allowed (${rate.maxHours})`
					});
				}
				const basicSalary = await tx
					.select({
						salary: salaries.amount
					})
					.from(salaries)
					.where(eq(salaries.staffId, staffId))
					.then((rows) => rows[0]);

				const total = (Number(basicSalary.salary) / 192) * (hours * Number(rate.rate));

				await tx.insert(overTime).values({
					staffId,
					overTimeTypeId: overtimeType,
					hours,
					total,
					reason,
					date,
					createdBy: locals.user?.id
				});
			});
			if (errorResponse) return errorResponse;
			return message(form, { type: 'success', text: 'Overtime Successuflly Added' });
		} catch (err) {
			return message(
				form,
				{
					type: 'error',
					text: 'An Error occured while adding Overtime' + err?.message
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

		const { id, staffId, reason, date, overtimeType, hours } = form.data;

		try {
			let errorResponse;
			await db.transaction(async (tx) => {
				const rate = await tx
					.select({
						rate: overTimeType.rate,
						name: overTimeType.name,
						maxHours: overTimeType.maxhours
					})
					.from(overTimeType)
					.where(eq(overTimeType.id, overtimeType))
					.then((rows) => rows[0]);

				console.log(hours > Number(rate?.maxHours) && rate?.maxHours !== null);

				if (!rate)
					errorResponse = message(form, { type: 'error', text: 'Overtime type not found' });

				if (hours > Number(rate?.maxHours) && rate?.maxHours !== null) {
					setError(form, 'hours', `Hours exceed maximum allowed (${rate.maxHours})`);
					errorResponse = message(form, {
						type: 'error',
						text: `Hours exceed maximum allowed (${rate.maxHours})`
					});
				}
				const basicSalary = await tx
					.select({
						salary: salaries.amount
					})
					.from(salaries)
					.where(eq(salaries.staffId, staffId))
					.then((rows) => rows[0]);

				const total = (Number(basicSalary.salary) / 192) * (hours * Number(rate.rate));
				await tx
					.update(overTime)
					.set({
						overTimeTypeId: overtimeType,
						hours: String(hours),
						total: String(total),
						reason,
						date: new Date(date),
						updatedBy: locals.user?.id
					})
					.where(eq(overTime.id, Number(id)));
			});
			if (errorResponse) return errorResponse;
			return message(form, { type: 'success', text: 'Overtime Successuflly Updated' });
		} catch (err) {
			return message(
				form,
				{
					type: 'error',
					text: 'An Error occured while updating Overtime' + err?.message
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
				softDeleteLookup(tx, overTime, Number(id), locals.user?.id)
			);

			if (!deleted) {
				return message(form, { type: 'error', text: 'That entry was not found' }, { status: 404 });
			}

			return message(form, { type: 'success', text: 'Overtime Successuflly Deleted' });
		} catch (err) {
			return message(
				form,
				{
					type: 'error',
					text: 'An Error occured while deleting Overtime' + err?.message
				},
				{ status: 500 }
			);
		}
	}
};
