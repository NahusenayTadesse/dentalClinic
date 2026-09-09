import { db } from '$lib/server/db';
import {
	paymentMethods,
	employee,
	payrollEntries,
	user,
	transactions,
	payrollAdjustments
} from '$lib/server/db/schema';
import { and, count, eq, getTableColumns, sql } from 'drizzle-orm';
import { notDeleted } from '$lib/server/softDelete';

import { paymentMethods as bankList } from '$lib/server/fastData';
import type { PageServerLoad } from '../../$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	const { id } = params;

	// 1. Create subqueries for your one-to-many relationships

	// 2. Main Query
	// const payrollData = await db
	//     .select({
	//         id: employee.id,
	//         payrollId: payrollEntries.id,
	//         name: sql<string>`TRIM(CONCAT_WS(' ', ${employee.name}, ${employee.fatherName}, ${employee.grandFatherName}))`,
	//         site: site.name,
	//         department: department.name,
	//         position: position.name,
	//         basicSalary: payrollEntries.basicSalary,
	//         positionAllowance: payrollEntries.positionAllowance,
	//         housingAllowance: payrollEntries.housingAllowance,
	//         transportAllowance: payrollEntries.transportAllowance,
	//         nonTaxable: payrollEntries.nonTaxableAllowance,
	//         paymentMethod: paymentMethods.name,
	//         attendancePenality: payrollEntries.attendancePenality,
	//         bank: paymentMethods.name,
	//         penEm: payrollEntries.penEm,
	//         penOrg: payrollEntries.penOrg,
	//         overTime: payrollEntries.overtimeAmount,
	//         bonus: payrollEntries.bonusAmount,
	//         taxAmount: payrollEntries.taxAmount,
	//         commision: payrollEntries.commissionAmount,
	//         deductions: payrollEntries.deductions,
	//         gross: payrollEntries.grossAmount,
	//         netPay: payrollEntries.netAmount
	//     })
	//     .from(payrollEntries)
	//     .leftJoin(employee, eq(payrollEntries.staffId, employee.id))
	//     .leftJoin(site, eq(employee.siteId, site.id))
	//     .leftJoin(department, eq(department.id, employee.departmentId))
	//     .leftJoin(position, eq(position.id, employee.positionId))
	//     .leftJoin(paymentMethods, eq(payrollEntries.paymentMethodId, paymentMethods.id))
	//     .where(and(eq(payrollEntries.month, month), eq(payrollEntries.year, Number(year))));

	const adjustments = await db
		.select({
			...getTableColumns(payrollAdjustments),
			name: sql<string>`TRIM(CONCAT_WS(' ', ${employee.name}, ${employee.fatherName}, ${employee.grandFatherName}))`,
			transactionId: transactions.id,
			recieptLink: transactions.recieptLink,
			paymentMethod: paymentMethods.name,
			addedBy: user.name
		})
		.from(payrollAdjustments)
		.innerJoin(
			transactions,
			and(eq(payrollAdjustments.transactionId, transactions.id), notDeleted(transactions))
		)
		.leftJoin(paymentMethods, eq(transactions.paymentMethodId, paymentMethods.id))
		.leftJoin(payrollEntries, eq(payrollAdjustments.payrollEntryId, payrollEntries.id))
		.leftJoin(employee, and(eq(payrollEntries.staffId, employee.id), notDeleted(employee)))
		.leftJoin(user, eq(payrollAdjustments.createdBy, user.id))
		.where(eq(transactions.id, Number(id)));
	// No .groupBy() needed here!

	return {
		adjustments
	};
};
