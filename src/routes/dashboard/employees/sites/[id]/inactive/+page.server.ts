import { db } from '$lib/server/db';
import {
	employee,
	department,
	employmentStatuses,
	educationalLevel,
	employeeTermination
} from '$lib/server/db/schema';
import { eq, and, sql, isNull } from 'drizzle-orm';
import { notDeleted } from '$lib/server/softDelete';
import type { PageServerLoad } from '../$types';
import { employeeFullName } from '$lib/server/employeeName';

export const load: PageServerLoad = async ({ locals, params }) => {
	const { id } = params;
	let staffList = await db
		.select({
			id: employee.id,
			// Handling potential nulls for both name parts
			name: employeeFullName,
			department: department.name,
			education: educationalLevel.name,
			status: employmentStatuses.name,
			terminationDate: employee.terminationDate,
			years: sql<number>`TIMESTAMPDIFF(YEAR, ${employee.hireDate}, CURDATE())`,
			joined: sql<string>`DATE_FORMAT(${employee.hireDate}, '%Y-%m-%d')`
		})
		.from(employee)
		.leftJoin(department, and(eq(department.id, employee.departmentId), notDeleted(department)))
		.leftJoin(
			employmentStatuses,
			and(eq(employmentStatuses.id, employee.employmentStatus), notDeleted(employmentStatuses))
		)
		.leftJoin(
			educationalLevel,
			and(eq(educationalLevel.id, employee.educationalLevel), notDeleted(educationalLevel))
		)
		.leftJoin(employeeTermination, eq(employeeTermination.staffId, employee.id))
		.where(and(eq(employee.isActive, true), eq(employee.siteId, id), notDeleted(employee)));

	staffList = staffList.map((r) => ({ ...r, years: Number(r.years) }));

	return {
		staffList
	};
};
