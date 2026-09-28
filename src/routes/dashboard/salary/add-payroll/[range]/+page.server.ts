import { currentMonthFilter } from '$lib/global.svelte';

import { db } from '$lib/server/db';
import {
	paymentMethods,
	salaries,
	employee,
	branch,
	department,
	staffAccounts,
	missingDays,
	overTime,
	deductions,
	bonuses,
	employmentStatuses,
	taxType,
	pensionRate,
	payrollRuns,
	payrollReceipts,
	payrollEntries,
	position,
	transactions
} from '$lib/server/db/schema';
import { asRequested, isApproved, unapprovedEmployeeIds } from '$lib/server/approvals';
import { and, count, or, lte, gte, eq, isNull, sql } from 'drizzle-orm';
import { notDeleted } from '$lib/server/softDelete';
import { paymentMethods as paymentMethodList } from '$lib/server/fastData';
import { incomeTaxSql, pensionRates } from '$lib/server/payrollMath';
import { commissionByStaff } from '$lib/server/commission';

import { payrollSchema, type EmployeeFormType } from './schema';
import type { PageServerLoad, Actions } from '../$types';
import { superValidate, message } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { getMonthNumber, ethiopianRange } from '$lib/global.svelte';

export const load: PageServerLoad = async ({ params }) => {
	const form = await superValidate(zod4(payrollSchema));

	const { range } = params as { range: string };

	const [m, y] = range.split('_');

	const monthNumber = getMonthNumber(m);
	const year = Number(y);

	const { startDate, endDate } = ethiopianRange(monthNumber, year);

	// Zero-padded ISO days. Unpadded ('2026-9-11') is not ISO, so JavaScript parses it as local
	// time where ISO would be UTC; and the completion day of a procedure is compared as a string.
	const pad = (n: number) => String(n).padStart(2, '0');
	const start = `${startDate.year}-${pad(startDate.month)}-${pad(startDate.day)}`;
	const end = `${endDate.year}-${pad(endDate.month)}-${pad(endDate.day)}`;

	// The two pension shares, found by who pays them — see `pensionRate` for why not by position.
	const rates = pensionRates(
		await db
			.select({ party: pensionRate.party, rate: pensionRate.rate })
			.from(pensionRate)
			.where(and(eq(pensionRate.status, true), notDeleted(pensionRate)))
	);

	const otSub = db
		.select({
			staffId: overTime.staffId,
			total: sql<number>`COALESCE(SUM(${overTime.total}), 0)`.as('total_ot')
		})
		.from(overTime)
		.where(and(currentMonthFilter(overTime.date, start, end), notDeleted(overTime)))
		.groupBy(overTime.staffId)
		.as('ot_sub');

	const bonusSub = db
		.select({
			staffId: bonuses.staffId,
			total: sql<number>`COALESCE(SUM(${bonuses.amount}), 0)`.as('total_bonus')
		})
		.from(bonuses)
		.where(and(currentMonthFilter(bonuses.bonusDate, start, end), notDeleted(bonuses)))
		.groupBy(bonuses.staffId)
		.as('bonus_sub');

	const deductionSub = db
		.select({
			staffId: deductions.staffId,
			total: sql<number>`COALESCE(SUM(${deductions.amount}), 0)`.as('total_deduct')
		})
		.from(deductions)
		.where(and(currentMonthFilter(deductions.deductionDate, start, end), notDeleted(deductions)))
		.groupBy(deductions.staffId)
		.as('deduct_sub');

	const missingSub = db
		.select({
			staffId: missingDays.staffId,
			missedCount: count(missingDays.id).as('missed_count')
		})
		.from(missingDays)
		.where(and(currentMonthFilter(missingDays.day, start, end), notDeleted(missingDays)))
		.groupBy(missingDays.staffId)
		.as('missing_sub');

	const commissionSub = commissionByStaff(start, end);

	const taxBands = await db
		.select({ threshold: taxType.threshold, rate: taxType.rate, deduction: taxType.deduction })
		.from(taxType)
		.where(and(eq(taxType.status, true), notDeleted(taxType)));
	const salarySub = db
		.select({
			staffId: salaries.staffId,
			proRatedAmount:
				sql<number>`SUM((${salaries.amount} / 30) * (DATEDIFF(LEAST(COALESCE(${salaries.endDate}, ${end}), ${end}), GREATEST(${salaries.startDate}, ${start})) + 1))`.as(
					'prorated_amount'
				),
			proRatedHousing:
				sql<number>`SUM((${salaries.housingAllowance} / 30) * (DATEDIFF(LEAST(COALESCE(${salaries.endDate}, ${end}), ${end}), GREATEST(${salaries.startDate}, ${start})) + 1))`.as(
					'prorated_housing'
				),
			proRatedTransport:
				sql<number>`SUM((${salaries.transportationAllowance} / 30) * (DATEDIFF(LEAST(COALESCE(${salaries.endDate}, ${end}), ${end}), GREATEST(${salaries.startDate}, ${start})) + 1))`.as(
					'prorated_transport'
				),
			proRatedPosition:
				sql<number>`SUM((${salaries.positionAllowance} / 30) * (DATEDIFF(LEAST(COALESCE(${salaries.endDate}, ${end}), ${end}), GREATEST(${salaries.startDate}, ${start})) + 1))`.as(
					'prorated_position'
				),
			proRatedNonTax:
				sql<number>`SUM((${salaries.nonTaxAllowance} / 30) * (DATEDIFF(LEAST(COALESCE(${salaries.endDate}, ${end}), ${end}), GREATEST(${salaries.startDate}, ${start})) + 1))`.as(
					'prorated_nontax'
				)
		})
		.from(salaries)
		.where(
			and(
				lte(salaries.startDate, end),
				or(isNull(salaries.endDate), gte(salaries.endDate, start)),
				// A salary change that has not been approved is not payable yet. The employee's
				// previous row is still open until approval, so they are paid at the old rate
				// rather than dropping out of the run.
				isApproved(salaries)
			)
		)
		.groupBy(salaries.staffId)
		.as('salary_sub');

	// Pension on the pro-rated basic salary: each share is a percentage of it (`payrollMath.ts`).
	const penEmExpression = sql<number>`ROUND(COALESCE(${salarySub.proRatedAmount}, 0) * ${rates.employee} / 100, 2)`;
	const penOrgExpression = sql<number>`ROUND(COALESCE(${salarySub.proRatedAmount}, 0) * ${rates.employer} / 100, 2)`;

	const grossExpression = sql<number>`
    COALESCE(${salarySub.proRatedAmount}, 0) +
    COALESCE(${otSub.total}, 0) +
    COALESCE(${bonusSub.total}, 0) +
    COALESCE(${commissionSub.commission}, 0) +
    COALESCE(${salarySub.proRatedHousing}, 0) +
    COALESCE(${salarySub.proRatedTransport}, 0) +
    COALESCE(${salarySub.proRatedPosition}, 0)
`;

	const taxableIncomeExpression = sql<number>`
    (${grossExpression})
    - (COALESCE(${salarySub.proRatedNonTax}, 0)
    + (COALESCE(${missingSub.missedCount}, 0) * (COALESCE(${salarySub.proRatedAmount}, 0) / 30)))
`;
	// The one rule for income tax, shared with the payslip adjustment and tested against it.
	const taxSql = incomeTaxSql(taxableIncomeExpression, taxBands);

	const netPayExpression = sql<number>`
  (${grossExpression}) - (
      ${taxSql} +
      (COALESCE(${missingSub.missedCount}, 0) * (COALESCE(${salarySub.proRatedAmount}, 0) / 30)) +
      COALESCE(${deductionSub.total}, 0) +
      (${penEmExpression})
  )
`;

	// Add this before your main payrollData query

	const payrollData = await db
		.select({
			id: employee.id,
			name: sql<string>`TRIM(CONCAT_WS(' ', ${employee.name}, ${employee.fatherName}, ${employee.grandFatherName}))`,
			department: department.name,
			position: position.name,
			basicSalary: salarySub.proRatedAmount,
			positionAllowance: salarySub.proRatedPosition,
			housingAllowance: salarySub.proRatedHousing,
			transportAllowance: salarySub.proRatedTransport,
			nonTaxable: salarySub.proRatedNonTax,
			attendancePenality: sql<number>`COALESCE(${missingSub.missedCount}, 0) * (COALESCE(${salarySub.proRatedAmount}, 0) / 30)`,
			account: staffAccounts.accountDetail,
			bank: paymentMethods.name,
			paymentMethodId: paymentMethods.id,
			employmentStatus: employmentStatuses.name,
			overtime: otSub.total,
			bonus: bonusSub.total,
			commission: sql<number>`COALESCE(${commissionSub.commission}, 0)`,
			absent: missingSub.missedCount,
			deductions: deductionSub.total,
			branch: branch.name,
			gross: grossExpression,
			taxable: taxableIncomeExpression,
			taxAmount: taxSql,
			penEm: penEmExpression,
			penOrg: penOrgExpression,
			netPay: netPayExpression
		})
		.from(employee)
		.leftJoin(department, and(eq(department.id, employee.departmentId), notDeleted(department)))
		.leftJoin(position, and(eq(position.id, employee.positionId), notDeleted(position)))
		.leftJoin(branch, and(eq(branch.id, employee.branchId), notDeleted(branch)))
		.leftJoin(salarySub, eq(salarySub.staffId, employee.id))
		.leftJoin(
			staffAccounts,
			and(
				eq(staffAccounts.staffId, employee.id),
				eq(staffAccounts.isActive, true),
				notDeleted(staffAccounts)
			)
		)
		.leftJoin(paymentMethods, eq(staffAccounts.paymentMethodId, paymentMethods.id))
		.leftJoin(otSub, eq(otSub.staffId, employee.id))
		.leftJoin(bonusSub, eq(bonusSub.staffId, employee.id))
		.leftJoin(commissionSub, eq(commissionSub.staffId, employee.id))
		.leftJoin(deductionSub, eq(deductionSub.staffId, employee.id))
		.leftJoin(missingSub, eq(missingSub.staffId, employee.id))
		.leftJoin(
			employmentStatuses,
			and(eq(employmentStatuses.id, employee.employmentStatus), notDeleted(employmentStatuses))
		)
		.leftJoin(
			payrollEntries,
			and(
				eq(payrollEntries.staffId, employee.id),
				eq(payrollEntries.month, m),
				eq(payrollEntries.year, Number(y))
			)
		)
		.where(
			and(
				eq(employee.isActive, true),
				isNull(payrollEntries.id),
				// An employee whose record is still pending — or was rejected — is not on the
				// payroll at all until someone approves them.
				isApproved(employee),
				notDeleted(employee)
			)
		)
		.groupBy(
			employee.id,
			employee.name,
			employee.fatherName,
			employee.grandFatherName,
			department.name,
			salarySub.proRatedAmount, // ADDED these to GroupBy
			salarySub.proRatedHousing,
			salarySub.proRatedTransport,
			salarySub.proRatedPosition,
			salarySub.proRatedNonTax,
			staffAccounts.id,
			paymentMethods.id,
			employmentStatuses.id,
			otSub.total,
			bonusSub.total,
			commissionSub.commission,
			deductionSub.total,
			missingSub.missedCount
		);

	return { payrollData, start, end, form, paymentMethods: await paymentMethodList() };
};

import { saveUploadedFile } from '$lib/server/upload';
export const actions: Actions = {
	runPayroll: async ({ request, locals }) => {
		const form = await superValidate(request, zod4(payrollSchema));
		const { employees, paymentMethod, start, end, reciept, month, paymentDate } = form.data;

		const [m, y] = month.split('_');

		const monthName = m;
		const year = y;

		const calculateTotal = (employees: EmployeeFormType[], key: keyof EmployeeFormType): number => {
			// If employees hasn't been populated by the effect yet, return 0
			if (!employees || !Array.isArray(employees)) return 0;

			const total = employees.reduce((sum, emp) => {
				const value = emp[key];
				// Cast to number just in case they are stringified numbers from an input
				const numValue = typeof value === 'string' ? parseFloat(value) : value;
				return sum + (typeof numValue === 'number' && !isNaN(numValue) ? numValue : 0);
			}, 0);

			return Math.round(total * 100) / 100;
		};

		const blocked = await unapprovedEmployeeIds(employees.map((emp) => Number(emp.id)));
		if (blocked.length > 0) {
			return message(
				form,
				{
					type: 'error',
					text: `${blocked.length} of the selected employees are not approved and cannot be paid. Reload the page and try again.`
				},
				{ status: 400 }
			);
		}

		// 1. Check for the existing record
		try {
			const recieptLink = reciept ? await saveUploadedFile(reciept) : null;
			await db.transaction(async (tx) => {
				// 1. Check or Create Payroll Run
				let payrollId: number;
				const existingPayroll = await tx
					.select({ id: payrollRuns.id })
					.from(payrollRuns)
					.where(and(eq(payrollRuns.month, monthName), eq(payrollRuns.year, Number(year))))
					.then((rows) => rows[0]);

				if (existingPayroll) {
					payrollId = existingPayroll.id;
				} else {
					const [newPayroll] = await tx
						.insert(payrollRuns)
						.values({
							...asRequested(locals?.user?.id),
							month: monthName,
							year: year,
							totalGross: '0',
							totalTax: '0',
							totalPosition: '0',
							totalPenalities: '0',
							totalHousing: '0',
							totalNet: '0',
							totalDeductions: '0',
							penEm: '0',
							penOrg: '0',
							createdBy: locals?.user?.id
						})
						.$returningId();
					payrollId = newPayroll.id;
				}

				await tx
					.update(payrollRuns)
					.set({
						totalNet: sql`${payrollRuns.totalNet} + ${calculateTotal(employees, 'netPay')}`,
						totalGross: sql`${payrollRuns.totalGross} + ${calculateTotal(employees, 'gross')}`,
						totalTransport: sql`${payrollRuns.totalTransport} + ${calculateTotal(employees, 'transportAllowance')}`,
						totalHousing: sql`${payrollRuns.totalHousing} + ${calculateTotal(employees, 'housingAllowance')}`,
						totalPosition: sql`${payrollRuns.totalPosition} + ${calculateTotal(employees, 'positionAllowance')}`,
						totalDeductions: sql`${payrollRuns.totalDeductions} + ${calculateTotal(employees, 'deductions')}`,
						totalTax: sql`${payrollRuns.totalTax} + ${calculateTotal(employees, 'taxAmount')}`,
						penEm: sql`${payrollRuns.penEm} + ${calculateTotal(employees, 'penEm')}`,
						// Was `totalTax + …`: the employer's pension total was built on the tax total.
						penOrg: sql`${payrollRuns.penOrg} + ${calculateTotal(employees, 'penOrg')}`,

						updatedBy: locals?.user?.id
					})
					.where(eq(payrollRuns.id, payrollId));

				// 2. Handle Receipt Upload

				const [transactionId] = await tx
					.insert(transactions)
					.values({
						paymentMethodId: paymentMethod,
						amount: calculateTotal(employees, 'netPay'),
						direction: 'out',
						recieptLink,
						description: 'Emplyees Salary Payment',
						createdBy: locals?.user?.id
					})
					.$returningId();

				await tx.insert(payrollReceipts).values({
					payrollRunId: payrollId,
					numberOfEmployees: employees.length,
					payPeriodStart: start,
					payPeriodEnd: end,
					paidDate: paymentDate,
					amount: String(calculateTotal(employees, 'netPay')),
					recieptLink,
					transactionId: transactionId.id,
					createdBy: locals?.user?.id
				});

				// 3. Prepare and Insert Payroll Entries
				const entryValues = employees.map((emp) => ({
					payrollId: payrollId,
					staffId: Number(emp.id),
					month: monthName.trim() as
						| 'መስከረም'
						| 'ጥቅምት'
						| 'ህዳር'
						| 'ታህሳስ'
						| 'ጥር'
						| 'የካቲት'
						| 'መጋቢት'
						| 'ሚያዝያ'
						| 'ግንቦት'
						| 'ሰኔ'
						| 'ሐምሌ'
						| 'ነሐሴ',
					year: Number(year),
					payPeriodStart: start,
					payPeriodEnd: end,
					basicSalary: emp.basicSalary.toString(),
					overtimeAmount: emp.overtime.toString(),
					deductions: emp.deductions.toString(), // Matches schema key
					commissionAmount: emp.commission.toString(),
					bonusAmount: emp.bonus.toString(),
					allowances: '0',
					transportAllowance: emp.transportAllowance.toString(),
					positionAllowance: emp.positionAllowance.toString(),
					housingAllowance: emp.housingAllowance.toString(),
					nonTaxableAllowance: emp.nonTaxable.toString(),
					grossAmount: emp.gross.toString(),
					netAmount: emp.netPay.toString(),
					paidAmount: emp.netPay.toString(), // Added to ensure the record shows what was paid
					attendancePenality: emp.attendancePenality.toString(),
					taxAmount: emp.taxAmount.toString(),
					penEm: emp.penEm.toString(),
					penOrg: emp.penOrg.toString(),
					status: 'paid' as const,
					paymentMethodId: emp.paymentMethodId ? Number(emp.paymentMethodId) : null,
					createdBy: locals?.user?.id,
					recieptLink,
					notes: 'Salary Paid',
					paymentDate

					// notes and receiptLink will default to null/default automatically
				}));

				await tx.insert(payrollEntries).values(entryValues);
			});

			// Outside the transaction. It was returned from inside the callback, which only makes it
			// the transaction's result: the action itself returned nothing, and a run that had paid
			// everyone never said so.
			return message(form, {
				type: 'success',
				text: `Successfully Paid ${employees.length} employees`
			});
		} catch (err: unknown) {
			// Loud in the log, quiet to the client (CLAUDE.md §9).
			console.error('runPayroll failed', err);
			return message(
				form,
				{ type: 'error', text: 'The payroll run could not be saved. Nothing was paid.' },
				{ status: 500 }
			);
		}
	}
};
