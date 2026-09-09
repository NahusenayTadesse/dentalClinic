import { superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { addLeavePayrollSchema as schema } from './schema';

import { db } from '$lib/server/db';
import { paymentMethods, employee, payrollEntries } from '$lib/server/db/schema';
import { eq, isNull, sql, and, count } from 'drizzle-orm';
import { notDeleted } from '$lib/server/softDelete';
import type { LayoutServerLoad } from './$types';
export const load: LayoutServerLoad = async ({ params }) => {
	const { id } = params;
	const form = await superValidate(zod4(schema));

	const payrollData = await db
		.select({
			id: employee.id,
			name: sql<string>`TRIM(CONCAT_WS(' ', ${employee.name}, ${employee.fatherName}, ${employee.grandFatherName}))`,
			month: payrollEntries.month,
			year: payrollEntries.year,
			basicSalary: payrollEntries.basicSalary,
			positionAllowance: payrollEntries.positionAllowance,
			housingAllowance: payrollEntries.housingAllowance,
			transportAllowance: payrollEntries.transportAllowance,
			nonTaxable: payrollEntries.nonTaxableAllowance,
			paymentMethod: paymentMethods.name,
			attendancePenality: payrollEntries.attendancePenality,
			bank: paymentMethods.name,
			overTime: payrollEntries.overtimeAmount,
			bonus: payrollEntries.bonusAmount,
			taxAmount: payrollEntries.taxAmount,
			commision: payrollEntries.commissionAmount,
			deductions: payrollEntries.deductions,
			gross: payrollEntries.grossAmount,
			netPay: payrollEntries.netAmount,
			recieptLink: payrollEntries.recieptLink
		})
		.from(payrollEntries)
		.leftJoin(employee, and(eq(payrollEntries.staffId, employee.id), notDeleted(employee)))
		.leftJoin(paymentMethods, eq(payrollEntries.paymentMethodId, paymentMethods.id))
		.where(eq(payrollEntries.staffId, Number(id)));

	const allMethods = await db
		.select({
			value: paymentMethods.id,
			name: paymentMethods.name,
			description: paymentMethods.description
		})
		.from(paymentMethods)
		.where(eq(paymentMethods.isActive, true));

	return {
		payrollData,
		allMethods,
		form,
		id
	};
};
