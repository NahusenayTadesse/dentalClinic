import { db } from '$lib/server/db';
import {
	paymentMethods,
	employee,
	department,
	branch,
	position,
	payrollEntries,
	payrollReceipts,
	payrollRuns,
	user,
	transactions,
	payrollAdjustments,
	taxType
} from '$lib/server/db/schema';
import { asRequested } from '$lib/server/approvals';
import { and, asc, count, desc, eq, getTableColumns, inArray, isNull, sql } from 'drizzle-orm';
import { notDeleted } from '$lib/server/softDelete';

import type { PageServerLoad } from '../$types';
import type { RequestEvent } from '@sveltejs/kit';
import { message, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { adjust, adjustableFields, finalizePayroll } from './schema';
import { saveUploadedFile } from '$lib/server/upload';
import { contentCrud } from '$lib/server/crud';
import { paymentMethods as bankList, officeEmployees as employeeList } from '$lib/server/fastData';

/**
 * Same "quick deduction" bracket lookup add-payroll uses: the first
 * threshold the taxable income falls under wins, taxed at that bracket's
 * flat rate minus its deduction. Brackets must be ascending by threshold.
 */
const calculateTax = (
	taxable: number,
	brackets: { threshold: string | null; rate: string; deduction: string }[]
) => {
	for (const bracket of brackets) {
		if (bracket.threshold !== null && taxable <= Number(bracket.threshold)) {
			return taxable * Number(bracket.rate) - Number(bracket.deduction);
		}
	}
	return 0;
};

/** The pay-component columns that make up gross pay (nonTaxableAllowance included; excluded only from the taxable base). */
const grossFields = adjustableFields.filter((field) => field !== 'deductions');

const payrollRunCrud = contentCrud({
	table: payrollRuns,
	label: 'Payroll Run',
	addSchema: finalizePayroll,
	editSchema: finalizePayroll,
	transform: (values, event) => ({
		...values,
		finalized: true,
		finalizedAt: new Date(),
		finalizedByUserId: event.locals.user?.id
	})
});

export const load: PageServerLoad = async ({ params, locals }) => {
	const { month_year } = params;
	const form = await superValidate(zod4(adjust));

	const [m, y] = month_year.split('_');

	const month = m;
	const year = y;

	// 1. Create subqueries for your one-to-many relationships

	// 2. Main Query
	const payrollData = await db
		.select({
			id: employee.id,
			payrollId: payrollEntries.id,
			name: sql<string>`TRIM(CONCAT_WS(' ', ${employee.name}, ${employee.fatherName}, ${employee.grandFatherName}))`,
			branch: branch.name,
			department: department.name,
			position: position.name,
			basicSalary: payrollEntries.basicSalary,
			positionAllowance: payrollEntries.positionAllowance,
			housingAllowance: payrollEntries.housingAllowance,
			transportAllowance: payrollEntries.transportAllowance,
			nonTaxable: payrollEntries.nonTaxableAllowance,
			paymentMethod: paymentMethods.name,
			attendancePenality: payrollEntries.attendancePenality,
			bank: paymentMethods.name,
			penEm: payrollEntries.penEm,
			penOrg: payrollEntries.penOrg,
			overTime: payrollEntries.overtimeAmount,
			bonus: payrollEntries.bonusAmount,
			taxAmount: payrollEntries.taxAmount,
			commision: payrollEntries.commissionAmount,
			deductions: payrollEntries.deductions,
			gross: payrollEntries.grossAmount,
			netPay: payrollEntries.netAmount
		})
		.from(payrollEntries)
		.leftJoin(employee, and(eq(payrollEntries.staffId, employee.id), notDeleted(employee)))
		.leftJoin(branch, and(eq(employee.branchId, branch.id), notDeleted(branch)))
		.leftJoin(department, and(eq(department.id, employee.departmentId), notDeleted(department)))
		.leftJoin(position, and(eq(position.id, employee.positionId), notDeleted(position)))
		.leftJoin(paymentMethods, eq(payrollEntries.paymentMethodId, paymentMethods.id))
		.where(and(eq(payrollEntries.month, month), eq(payrollEntries.year, Number(year))));

	const payrollReciept = await db
		.select({
			id: payrollReceipts.id,
			payPeriodStart: payrollReceipts.payPeriodStart,
			payPeriodEnd: payrollReceipts.payPeriodEnd,
			amount: payrollReceipts.amount,
			paidDate: payrollReceipts.paidDate,
			numberOfEmployees: payrollReceipts.numberOfEmployees,
			recieptLink: payrollReceipts.recieptLink,
			uploadedBy: user.name,
			uploadedById: user.id
		})
		.from(payrollReceipts)
		.leftJoin(payrollRuns, eq(payrollReceipts.payrollRunId, payrollRuns.id))
		.leftJoin(user, eq(payrollReceipts.createdBy, user.id))
		.where(and(eq(payrollRuns.month, month), eq(payrollRuns.year, Number(year))));

	const adjustments = await db
		.select({
			...getTableColumns(payrollAdjustments),
			transactionId: transactions.id,
			recieptLink: transactions.recieptLink,
			paymentMethod: paymentMethods.name,
			addedBy: user.name,
			count: count(payrollAdjustments.id)
		})
		.from(payrollAdjustments)
		.leftJoin(
			transactions,
			and(eq(payrollAdjustments.transactionId, transactions.id), notDeleted(transactions))
		)
		.leftJoin(paymentMethods, eq(transactions.paymentMethodId, paymentMethods.id))
		.leftJoin(user, eq(payrollAdjustments.createdBy, user.id))
		.where(
			inArray(
				payrollAdjustments.payrollEntryId,
				payrollData.map((entry) => entry.payrollId)
			)
		)
		.groupBy(transactions.id, paymentMethods.name, user.name);

	const banks = await bankList();
	const employees = await employeeList();

	const [payrollRun] = await db
		.select({
			id: payrollRuns.id,
			finalized: payrollRuns.finalized,
			finalizedAt: payrollRuns.finalizedAt,
			finalizedBy: sql<string>`CONCAT(${employee.name}, ' ', ${employee.fatherName})`
		})
		.from(payrollRuns)
		.leftJoin(employee, and(eq(payrollRuns.finalizedBy, employee.id), notDeleted(employee)))
		.where(and(eq(payrollRuns.month, month), eq(payrollRuns.year, Number(year))));

	const finalizeForm = await superValidate(zod4(finalizePayroll));

	return {
		payrollData,
		payrollReciept,
		adjustments,
		month,
		banks,
		employees,
		payrollRun,
		finalizeForm,
		year,
		form
	};
};

export const actions = {
	/**
	 * Finalising is what moves the money, so it is the one action that must refuse an unapproved
	 * run. `contentCrud.actions.edit` is generic and knows nothing about approval, so the check
	 * sits here rather than in the shared helper, where it would change behaviour for every other
	 * table using it.
	 */
	finalize: async (event: RequestEvent) => {
		const form = await superValidate(event.request.clone(), zod4(finalizePayroll));

		if (form.valid) {
			const [run] = await db
				.select({ status: payrollRuns.approvalStatus })
				.from(payrollRuns)
				.where(eq(payrollRuns.id, form.data.id));

			if (run && run.status !== 'approved') {
				return message(form, {
					type: 'error',
					text:
						run.status === 'rejected'
							? 'This payroll run was rejected and cannot be finalized.'
							: 'This payroll run is still awaiting approval and cannot be finalized yet.'
				});
			}
		}

		return payrollRunCrud.actions.edit(event);
	},

	adjust: async ({ request, locals, params }) => {
		const form = await superValidate(request, zod4(adjust));
		if (!form.valid) {
			return message(form, {
				type: 'error',
				text: 'Form is invalid, please the check the form and try again'
			});
		}

		const [m, y] = params.month_year.split('_');
		const [run] = await db
			.select({ finalized: payrollRuns.finalized })
			.from(payrollRuns)
			.where(and(eq(payrollRuns.month, m), eq(payrollRuns.year, Number(y))));

		if (run?.finalized) {
			return message(
				form,
				{ type: 'error', text: 'This payroll run is finalized; adjustments are disabled' },
				{ status: 400 }
			);
		}

		try {
			const { id, adjustmentType, amount, reason, reciept, bank, ...fields } = form.data;

			const recieptLink = await saveUploadedFile(reciept);
			const sign = adjustmentType === 'bonus' ? 1 : -1;

			const entries = await db.select().from(payrollEntries).where(inArray(payrollEntries.id, id));

			const taxBrackets = await db
				.select()
				.from(taxType)
				.where(eq(taxType.status, true))
				.orderBy(asc(taxType.threshold));

			let totalNetDelta = 0;

			await db.transaction(async (tx) => {
				const [transaction] = await tx
					.insert(transactions)
					.values({
						description: 'Salary Adjustment ' + reason,
						amount: '0',
						paymentMethodId: bank,
						recieptLink,
						paymentStatus: 'paid'
					})
					.$returningId();

				for (const entry of entries) {
					const deltas = Object.fromEntries(
						adjustableFields.map((field) => [field, sign * fields[field]])
					) as Record<(typeof adjustableFields)[number], number>;

					const updated = Object.fromEntries(
						adjustableFields.map((field) => [field, Number(entry[field] ?? 0) + deltas[field]])
					) as Record<(typeof adjustableFields)[number], number>;

					const grossAmount = grossFields.reduce((sum, field) => sum + updated[field], 0);
					const taxableIncome = Math.max(
						grossAmount - updated.nonTaxableAllowance - Number(entry.attendancePenality ?? 0),
						0
					);
					const taxAmount = calculateTax(taxableIncome, taxBrackets);
					const amountDelta = sign * amount;
					const netAmount =
						grossAmount -
						taxAmount -
						updated.deductions -
						Number(entry.penEm ?? 0) -
						Number(entry.penOrg ?? 0) +
						amountDelta;

					const netDelta = netAmount - Number(entry.netAmount ?? 0);
					totalNetDelta += netDelta;

					await tx
						.update(payrollEntries)
						.set({
							...Object.fromEntries(
								adjustableFields.map((field) => [field, String(updated[field])])
							),
							grossAmount: String(grossAmount),
							taxAmount: String(taxAmount),
							netAmount: String(netAmount)
						})
						.where(eq(payrollEntries.id, entry.id));

					await tx.insert(payrollAdjustments).values({
						...asRequested(locals?.user?.id),
						payrollEntryId: entry.id,
						adjustmentType,
						amount: String(amountDelta),
						...Object.fromEntries(adjustableFields.map((field) => [field, String(deltas[field])])),
						grossAmount: String(grossAmount - Number(entry.grossAmount ?? 0)),
						netAmount: String(netDelta),
						reason,
						createdBy: locals?.user?.id,
						transactionId: transaction.id
					});
				}

				await tx
					.update(transactions)
					.set({ amount: String(totalNetDelta) })
					.where(eq(transactions.id, transaction.id));
			});

			return message(form, {
				type: 'success',
				text: 'Adjustment saved successfully'
			});
		} catch (error) {
			console.error('Error during adjustment:', error);
			return message(
				form,
				{
					type: 'error',
					text: 'Something went wrong, please try again ' + error.message
				},
				{ status: 500 }
			);
		}
	}
};
