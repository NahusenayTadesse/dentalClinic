import { db } from '$lib/server/db';
import { salaries, user, branch, department, position } from '$lib/server/db/schema';

import { eq, and, sql, desc } from 'drizzle-orm';
import { notDeleted } from '$lib/server/softDelete';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const { id } = params;

	const salaryHistory = await db
		.select({
			id: salaries.id,
			amount: salaries.amount,
			branch: branch.name,
			branchId: branch.id,
			officeCommission: salaries.officeCommission,
			percentage: salaries.percentage,
			department: department.name,
			position: position.name,
			baseSalary: salaries.amount,
			housingAllowance: salaries.housingAllowance,
			transportationAllowance: salaries.transportationAllowance,
			nonTaxAllowance: salaries.nonTaxAllowance,
			positionAllowance: salaries.positionAllowance,
			startDate: salaries.startDate,
			endDate: salaries.endDate,
			changedBy: user.name,
			changedById: user.id
		})
		.from(salaries)
		.leftJoin(user, eq(salaries.createdBy, user.id))
		.leftJoin(branch, and(eq(salaries.branchId, branch.id), notDeleted(branch)))
		.leftJoin(department, and(eq(salaries.departmentId, department.id), notDeleted(department)))
		.leftJoin(position, and(eq(salaries.positionId, position.id), notDeleted(position)))
		.where(eq(salaries.staffId, Number(id)))
		.orderBy(desc(salaries.createdAt));

	return {
		salaryHistory
	};
};
