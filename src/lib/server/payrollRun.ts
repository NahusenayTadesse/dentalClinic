import { and, eq, gte, inArray, isNull, lte, or, sql } from 'drizzle-orm';

import { db } from '$lib/server/db';
import {
	paymentMethods,
	salaries,
	employee,
	branch,
	department,
	staffAccounts,
	overTime,
	deductions,
	bonuses,
	employmentStatuses,
	taxType,
	pensionRate,
	payrollEntries,
	position
} from '$lib/server/db/schema';
import { isApproved } from '$lib/server/approvals';
import { notDeleted } from '$lib/server/softDelete';
import { incomeTax, netPay, pensionRates, toCents } from '$lib/server/payrollMath';
import { absencesBetween } from '$lib/server/attendance';
import { commissionByStaff } from '$lib/server/commission';
import { currentMonthFilter, ethiopianRange, getMonthNumber } from '$lib/global.svelte';

/**
 * What a month's payroll pays each employee — one query, read by the page that shows the run and
 * by the action that pays it.
 *
 * **Why the action reads it too.** The run page used to compute every payslip, send the figures to
 * the browser, and write whatever came back: gross, tax, pension and net, as posted. Anyone who
 * could post to the action could pay any amount, and a page left open while a bonus was added
 * paid the old figure. CLAUDE.md §9 says the server decides those; now it does — the browser
 * says *who* is being paid and from which account, and the action recomputes *what* inside its
 * transaction, from this same query.
 *
 * Pay is pro-rated by day across salary changes, plus overtime, bonuses and commission in the
 * period; less unexcused absence (the attendance register), deductions, the employee's pension and
 * income tax (`payrollMath.ts`). An employee already paid for the month,
 * inactive, or not approved is not in it.
 *
 * Portability: the pro-rating is MySQL date arithmetic (`DATEDIFF`, `LEAST`, `GREATEST`), recorded
 * in `PORTABILITY.md`. It moved here from the route unchanged.
 */

/** A transaction on the database, as `db.transaction` hands it over. */
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Reader = Tx | typeof db;

/** The month names payslips are filed under, as the schema's enum spells them. */
export type PayrollMonth =
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
	| 'ነሐሴ';

/** A payroll period: the Ethiopian month it is filed under and its Gregorian first and last day. */
export type PayrollPeriod = { month: PayrollMonth; year: number; start: string; end: string };

/** The period a run route names, `<month>_<year>` — the route's, never a posted one. */
export function payrollPeriod(range: string): PayrollPeriod {
	const [m, y] = range.split('_');
	const year = Number(y);
	const { startDate, endDate } = ethiopianRange(getMonthNumber(m), year);
	// Zero-padded ISO days. Unpadded ('2026-9-11') is not ISO, so JavaScript parses it as local
	// time where ISO would be UTC; and the completion day of a procedure is compared as a string.
	const pad = (n: number) => String(n).padStart(2, '0');
	return {
		month: m.trim() as PayrollMonth,
		year,
		start: `${startDate.year}-${pad(startDate.month)}-${pad(startDate.day)}`,
		end: `${endDate.year}-${pad(endDate.month)}-${pad(endDate.day)}`
	};
}

/**
 * Every unpaid payslip for the period, or only those of `staffIds` — the run's selection, when the
 * action pays it. `reader` is the paying transaction, so the figures are the ones current as the
 * money moves.
 */
export async function payslips(
	period: PayrollPeriod,
	{ staffIds, reader = db }: { staffIds?: number[]; reader?: Reader } = {}
) {
	const { start, end } = period;

	// The two pension shares, found by who pays them — see `pensionRate` for why not by position.
	const rates = pensionRates(
		await reader
			.select({ party: pensionRate.party, rate: pensionRate.rate })
			.from(pensionRate)
			.where(and(eq(pensionRate.status, true), notDeleted(pensionRate)))
	);

	const otSub = reader
		.select({
			staffId: overTime.staffId,
			total: sql<number>`COALESCE(SUM(${overTime.total}), 0)`.as('total_ot')
		})
		.from(overTime)
		.where(and(currentMonthFilter(overTime.date, start, end), notDeleted(overTime)))
		.groupBy(overTime.staffId)
		.as('ot_sub');

	const bonusSub = reader
		.select({
			staffId: bonuses.staffId,
			total: sql<number>`COALESCE(SUM(${bonuses.amount}), 0)`.as('total_bonus')
		})
		.from(bonuses)
		.where(and(currentMonthFilter(bonuses.bonusDate, start, end), notDeleted(bonuses)))
		.groupBy(bonuses.staffId)
		.as('bonus_sub');

	const deductionSub = reader
		.select({
			staffId: deductions.staffId,
			total: sql<number>`COALESCE(SUM(${deductions.amount}), 0)`.as('total_deduct')
		})
		.from(deductions)
		.where(and(currentMonthFilter(deductions.deductionDate, start, end), notDeleted(deductions)))
		.groupBy(deductions.staffId)
		.as('deduct_sub');

	const commissionSub = commissionByStaff(start, end, reader);

	const taxBands = await reader
		.select({ threshold: taxType.threshold, rate: taxType.rate, deduction: taxType.deduction })
		.from(taxType)
		.where(and(eq(taxType.status, true), notDeleted(taxType)));
	const salarySub = reader
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

	const rows = await reader
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
			account: staffAccounts.accountDetail,
			bank: paymentMethods.name,
			paymentMethodId: paymentMethods.id,
			employmentStatus: employmentStatuses.name,
			overtime: otSub.total,
			bonus: bonusSub.total,
			commission: sql<number>`COALESCE(${commissionSub.commission}, 0)`,
			deductions: deductionSub.total,
			branch: branch.name,
			gross: grossExpression,
			penEm: penEmExpression,
			penOrg: penOrgExpression
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
		.leftJoin(
			employmentStatuses,
			and(eq(employmentStatuses.id, employee.employmentStatus), notDeleted(employmentStatuses))
		)
		.leftJoin(
			payrollEntries,
			and(
				eq(payrollEntries.staffId, employee.id),
				eq(payrollEntries.month, period.month),
				eq(payrollEntries.year, period.year)
			)
		)
		.where(
			and(
				eq(employee.isActive, true),
				isNull(payrollEntries.id),
				// An employee whose record is still pending — or was rejected — is not on the
				// payroll at all until someone approves them.
				isApproved(employee),
				notDeleted(employee),
				staffIds ? inArray(employee.id, staffIds.length ? staffIds : [-1]) : undefined
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
			deductionSub.total
		);

	/*
	 * Absence, and what follows from it, per payslip: the register's unexcused absences
	 * (`server/attendance.ts`) — the same rule its screens show — each a thirtieth of the month's
	 * basic pay. It was a count of `missing_days` rows, deducting even the ones marked not to be.
	 * Taxable pay, tax and net are worked out here from it with `payrollMath`, whose `incomeTax` is
	 * tested to agree with the SQL rule this used to run.
	 */
	const absences = await absencesBetween(
		start,
		end,
		rows.map((r) => r.id),
		reader
	);
	const bands = taxBands.map((b) => ({
		threshold: b.threshold === null ? null : Number(b.threshold),
		rate: Number(b.rate),
		deduction: Number(b.deduction)
	}));
	return rows.map((row) => {
		const basic = Number(row.basicSalary ?? 0);
		const gross = Number(row.gross ?? 0);
		const absent = absences.get(row.id) ?? 0;
		const attendancePenality = toCents((absent * basic) / 30);
		const taxable = toCents(gross - Number(row.nonTaxable ?? 0) - attendancePenality);
		const taxAmount = incomeTax(taxable, bands);
		return {
			...row,
			absent,
			attendancePenality,
			taxable,
			taxAmount,
			netPay: netPay({
				gross,
				tax: taxAmount,
				absenceDeduction: attendancePenality,
				deductions: Number(row.deductions ?? 0),
				employeePension: Number(row.penEm ?? 0)
			})
		};
	});
}

/** One payslip as `payslips` computes it. */
export type Payslip = Awaited<ReturnType<typeof payslips>>[number];
