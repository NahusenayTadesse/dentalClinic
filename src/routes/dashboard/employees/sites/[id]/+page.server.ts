import { db } from '$lib/server/db';
import {
	employee,
	department,
	employmentStatuses,
	educationalLevel,
	employeeTermination,
	missingDays,
	site,
	employeeGuarantor,
	staffAccounts,
	staffFamilies,
	position
} from '$lib/server/db/schema';
import { eq, and, sql, isNull, count, countDistinct } from 'drizzle-orm';
import { notDeleted } from '$lib/server/softDelete';
import { edit } from './schema';
import type { PageServerLoad, Actions } from '../$types';
import { superValidate, message } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';

export const load: PageServerLoad = async ({ params }) => {
	const { id } = params;

	let staffList = await db
		.select({
			id: employee.id,
			// Handling potential nulls for both name parts
			name: sql<string>`TRIM(CONCAT(COALESCE(${employee.name}, ''), ' ', COALESCE(${employee.fatherName}, '')))`,
			department: department.name,
			position: position.name,
			site: site.name,
			education: educationalLevel.name,
			status: employmentStatuses.name,
			guarantor: countDistinct(employeeGuarantor.id),
			accounts: countDistinct(staffAccounts.id),
			families: countDistinct(staffFamilies.id),
			active: employee.isActive,
			years: sql<number>`TIMESTAMPDIFF(YEAR, ${employee.hireDate}, CURDATE())`,
			joined: sql<string>`DATE_FORMAT(${employee.hireDate}, '%Y-%m-%d')`
		})
		.from(employee)
		.leftJoin(site, and(eq(site.id, employee.siteId), notDeleted(site)))
		.leftJoin(department, and(eq(department.id, employee.departmentId), notDeleted(department)))
		.leftJoin(position, and(eq(position.id, employee.positionId), notDeleted(position)))
		.leftJoin(
			employmentStatuses,
			and(eq(employmentStatuses.id, employee.employmentStatus), notDeleted(employmentStatuses))
		)
		.leftJoin(
			educationalLevel,
			and(eq(educationalLevel.id, employee.educationalLevel), notDeleted(educationalLevel))
		)
		.leftJoin(employeeTermination, eq(employeeTermination.staffId, employee.id))
		.leftJoin(staffAccounts, and(eq(staffAccounts.staffId, employee.id), notDeleted(staffAccounts)))
		.leftJoin(employeeGuarantor, eq(employeeGuarantor.staffId, employee.id))
		.leftJoin(staffFamilies, and(eq(staffFamilies.staffId, employee.id), notDeleted(staffFamilies)))
		.where(and(eq(employee.isActive, true), eq(employee.siteId, id), notDeleted(employee)))
		.groupBy(
			employee.id,
			employee.name,
			employee.fatherName,
			department.name,
			site.name,
			educationalLevel.name,
			employmentStatuses.name,
			employee.isActive,
			employee.hireDate
		);

	staffList = staffList.map((r) => ({ ...r, years: Number(r.years) }));

	return {
		staffList
	};
};

export const actions: Actions = {
	addDays: async ({ request, cookies, locals }) => {
		const form = await superValidate(request, zod4(edit));

		if (!form.valid) {
			return message(form, { type: 'error', text: `Error: check the form` });
		}

		const { id, day, reason, deductable, deductableAmount } = form.data;

		try {
			const dateList = day.split(',');
			await db.transaction(async (tx) => {
				const valuesToInsert = dateList.map((singleDay) => ({
					staffId: Number(id),
					day: singleDay.trim(), // trim() handles potential spaces like "2026-01-01, 2026-01-02"
					reason,
					deductable: Boolean(deductable),
					deductableAmount: deductableAmount ? parseFloat(deductableAmount) : null,
					createdBy: locals?.user?.id
				}));

				// 3. Perform a single batch insert
				await tx.insert(missingDays).values(valuesToInsert);
			});
			return message(form, {
				type: 'success',
				text: 'Missing Days added Successfully!'
			});
		} catch (err) {
			console.error(err?.message);
			return message(form, {
				type: 'error',
				text: `Adding missing days failed: ${err instanceof Error ? err.message : 'Unknown error'}`
			});
		}
	}
};
