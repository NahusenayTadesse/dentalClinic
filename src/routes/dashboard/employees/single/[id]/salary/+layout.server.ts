import { superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { addLeavePayrollSchema as schema } from './schema';

import { db } from '$lib/server/db';
import {
	salaries,
	paymentMethods,
	overTime,
	deductions,
	bonuses,
	employee,
	missingDays
} from '$lib/server/db/schema';
import { eq, isNull, sql, and, count } from 'drizzle-orm';
import { notDeleted } from '$lib/server/softDelete';
import type { LayoutServerLoad } from './$types';
import { employeeFullName } from '$lib/server/employeeName';
export const load: LayoutServerLoad = async ({ params }) => {
	const { id } = params;
	const form = await superValidate(zod4(schema));

	const salaryDetail = await db
		.select({
			id: employee.id,
			name: employeeFullName,

			// sum of all deductions for the staff
			deductions: sql<number>`COALESCE(SUM(${deductions.amount}), 0)`,

			// sum of all commissions from commissionProduct AND commissionService

			// base salary (assumed single row per staff)
			baseSalary: salaries.amount,
			housingAllowance: salaries.housingAllowance,
			transportationAllowance: salaries.transportationAllowance,
			nonTaxAllowance: salaries.nonTaxAllowance,
			positionAllowance: salaries.positionAllowance,
			missingDays: count(missingDays.id),
			overtime: overTime.total,
			bonus: bonuses.amount
		})
		.from(employee)
		.leftJoin(salaries, and(eq(salaries.staffId, employee.id), isNull(salaries.endDate)))
		.leftJoin(deductions, and(eq(deductions.staffId, employee.id), notDeleted(deductions)))
		.leftJoin(missingDays, and(eq(missingDays.staffId, employee.id), notDeleted(missingDays)))
		.leftJoin(overTime, and(eq(overTime.staffId, employee.id), notDeleted(overTime)))
		.leftJoin(bonuses, and(eq(bonuses.staffId, employee.id), notDeleted(bonuses)))
		.where(and(eq(employee.id, Number(id)), notDeleted(employee)))
		.groupBy(employee.id, salaries.amount)
		.then((rows) => rows[0]);

	const allMethods = await db
		.select({
			value: paymentMethods.id,
			name: paymentMethods.name,
			description: paymentMethods.description
		})
		.from(paymentMethods)
		.where(eq(paymentMethods.isActive, true));

	return {
		salaryDetail,
		allMethods,
		form,
		id
	};
};
