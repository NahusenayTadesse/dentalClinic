import { and, count, desc, eq, isNotNull, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import {
	auditLog,
	bonuses,
	customers,
	damagedSupplies,
	deductions,
	department,
	educationalLevel,
	employee,
	employeeLeaveGrant,
	employeeTermination,
	employmentStatuses,
	expenses,
	expensesType,
	leave,
	leaveType,
	missingDays,
	overTime,
	overTimeType,
	paymentMethods,
	payrollAdjustments,
	payrollEntries,
	payrollReceipts,
	payrollRuns,
	position,
	salaries,
	services,
	branch,
	supplies,
	suppliesAdjustments,
	supplySuppliers,
	supplyTypes,
	transactions,
	invoiceLine,
	user
} from '$lib/server/db/schema';
import { notDeleted } from '$lib/server/softDelete';
import type { ReportFilters } from './filters';
import { all, amountScope, inRange, n, searchScope, staffName, staffScope } from './scope.server';
import { onHand } from '$lib/server/stock';
import { billedLines } from './billedLines.server';
import { accessLogCount, accessLogPage, accessLogWhere } from '$lib/server/accessLog';
import { VIEWED_RECORD_LABEL, VIEW_ACTION_LABEL } from '$lib/accessLog';
import { clinicDayRange } from '$lib/clinicTime';

export type DetailResult = { rows: Record<string, unknown>[]; total: number };

/**
 * Columns that arrive from MySQL as decimal strings and have to reach the table
 * as numbers, because the currency formatter and the table's own sorting both
 * treat a string as text — `"9.00"` would otherwise sort above `"10.00"`.
 */
const NUMERIC_KEYS: Record<string, string[]> = {
	'payroll-runs': [
		'totalSalaries',
		'totalOvertime',
		'totalTransport',
		'totalHousing',
		'totalPosition',
		'totalNet',
		'totalDeductions',
		'totalPenalities',
		'totalTax',
		'totalGross',
		'penEm',
		'penOrg'
	],
	'payroll-entries': [
		'basicSalary',
		'overtime',
		'bonus',
		'commission',
		'transport',
		'housing',
		'positionAllowance',
		'nonTaxable',
		'gross',
		'tax',
		'deductions',
		'attendancePenalty',
		'penEm',
		'penOrg',
		'net',
		'paid'
	],
	'payroll-adjustments': ['amount', 'gross', 'net'],
	'payroll-receipts': ['amount'],
	'salary-changes': ['amount', 'transport', 'housing', 'positionAllowance', 'nonTax', 'percentage'],
	employees: ['salary', 'leavesLeft'],
	hires: ['salary'],
	terminations: [],
	bonuses: ['amount'],
	overtime: ['hours', 'rate', 'amount'],
	deductions: ['amount'],
	attendance: ['amount'],
	leaves: ['days'],
	'leave-grants': ['granted', 'used', 'remaining'],
	'supply-adjustments': ['adjustment', 'costPerItem', 'total'],
	'damaged-supplies': ['quantity'],
	stock: ['quantity', 'reorderLevel'],
	transactions: ['amount'],
	expenses: ['amount'],
	'services-rendered': ['price', 'tip', 'tax', 'total'],
	'branch-payments': ['request', 'payment', 'beforeVat', 'vatRate', 'vat', 'withhold', 'penalty'],
	'payment-requests': ['amount', 'penalty', 'vat', 'withholding'],
	contracts: ['monthlyAmount'],
	renewals: ['amount'],
	'branch-penalties': ['amount'],
	customers: ['branches'],
	'audit-log': []
};

function coerce(section: string, rows: Record<string, unknown>[]): Record<string, unknown>[] {
	const keys = NUMERIC_KEYS[section] ?? [];
	if (keys.length === 0) return rows;

	return rows.map((row) => {
		const copy = { ...row };
		for (const key of keys) {
			if (key in copy) copy[key] = copy[key] === null ? null : n(copy[key]);
		}
		return copy;
	});
}

/** `YYYY-MM-DD` for a date/datetime column, so the table never prints a timestamp. */
const day = (column: Parameters<typeof inRange>[0]) =>
	sql<string>`DATE_FORMAT(${column}, '%Y-%m-%d')`;

/**
 * Fetches one page of one ledger.
 *
 * Every branch runs the same shape — build the WHERE from the shared filters,
 * count against it, then read the page — so the section list can grow without
 * the loader growing a second way of doing things.
 */
export async function loadSection(filters: ReportFilters): Promise<DetailResult> {
	const scope = staffScope(filters);
	const offset = (filters.page - 1) * filters.pageSize;
	const search = filters.search;

	/**
	 * Drizzle's builders are thenable, so structural typing on `limit`/`offset`
	 * is enough to page any of them without naming the twenty-odd row shapes.
	 */
	type Pageable = { limit: (n: number) => { offset: (n: number) => PromiseLike<unknown[]> } };

	const page = async (query: Pageable): Promise<Record<string, unknown>[]> =>
		(await query.limit(filters.pageSize).offset(offset)) as Record<string, unknown>[];

	async function run(
		builder: () => Promise<Record<string, unknown>[]>,
		counter: () => Promise<{ total: number }[]>
	): Promise<DetailResult> {
		const [rows, [{ total }]] = await Promise.all([builder(), counter()]);
		return { rows: coerce(filters.section, rows), total: Number(total ?? 0) };
	}

	switch (filters.section) {
		case 'payroll-entries': {
			const where = all([
				notDeleted(payrollEntries),
				notDeleted(employee),
				inRange(payrollEntries.payPeriodStart, filters),
				filters.payrollStatus
					? sql`${payrollEntries.status} = ${filters.payrollStatus}`
					: undefined,
				filters.paymentMethodId
					? eq(payrollEntries.paymentMethodId, filters.paymentMethodId)
					: undefined,
				...amountScope(payrollEntries.netAmount, filters),
				...scope,
				searchScope(search, [staffName, payrollEntries.notes])
			]);

			return run(
				() =>
					page(
						db
							.select({
								id: payrollEntries.id,
								employee: staffName,
								department: department.name,
								branch: branch.name,
								month: payrollEntries.month,
								year: payrollEntries.year,
								periodStart: day(payrollEntries.payPeriodStart),
								periodEnd: day(payrollEntries.payPeriodEnd),
								basicSalary: payrollEntries.basicSalary,
								overtime: payrollEntries.overtimeAmount,
								bonus: payrollEntries.bonusAmount,
								commission: payrollEntries.commissionAmount,
								transport: payrollEntries.transportAllowance,
								housing: payrollEntries.housingAllowance,
								positionAllowance: payrollEntries.positionAllowance,
								nonTaxable: payrollEntries.nonTaxableAllowance,
								gross: payrollEntries.grossAmount,
								tax: payrollEntries.taxAmount,
								deductions: payrollEntries.deductions,
								attendancePenalty: payrollEntries.attendancePenality,
								penEm: payrollEntries.penEm,
								penOrg: payrollEntries.penOrg,
								net: payrollEntries.netAmount,
								paid: payrollEntries.paidAmount,
								status: payrollEntries.status,
								paymentMethod: paymentMethods.name,
								paymentDate: day(payrollEntries.paymentDate)
							})
							.from(payrollEntries)
							.innerJoin(employee, eq(payrollEntries.staffId, employee.id))
							.leftJoin(department, eq(employee.departmentId, department.id))
							.leftJoin(branch, eq(employee.branchId, branch.id))
							.leftJoin(paymentMethods, eq(payrollEntries.paymentMethodId, paymentMethods.id))
							.where(where)
							.orderBy(desc(payrollEntries.payPeriodStart), desc(payrollEntries.id))
					),
				() =>
					db
						.select({ total: count() })
						.from(payrollEntries)
						.innerJoin(employee, eq(payrollEntries.staffId, employee.id))
						.where(where)
			);
		}

		case 'payroll-adjustments': {
			const where = all([
				notDeleted(payrollAdjustments),
				inRange(payrollAdjustments.createdAt, filters),
				...amountScope(payrollAdjustments.amount, filters),
				...scope,
				searchScope(search, [staffName, payrollAdjustments.reason])
			]);

			return run(
				() =>
					page(
						db
							.select({
								id: payrollAdjustments.id,
								date: day(payrollAdjustments.createdAt),
								employee: staffName,
								adjustmentType: payrollAdjustments.adjustmentType,
								amount: payrollAdjustments.amount,
								gross: payrollAdjustments.grossAmount,
								net: payrollAdjustments.netAmount,
								month: payrollEntries.month,
								year: payrollEntries.year,
								reason: payrollAdjustments.reason
							})
							.from(payrollAdjustments)
							.leftJoin(payrollEntries, eq(payrollAdjustments.payrollEntryId, payrollEntries.id))
							.leftJoin(employee, eq(payrollEntries.staffId, employee.id))
							.where(where)
							.orderBy(desc(payrollAdjustments.createdAt))
					),
				() =>
					db
						.select({ total: count() })
						.from(payrollAdjustments)
						.leftJoin(payrollEntries, eq(payrollAdjustments.payrollEntryId, payrollEntries.id))
						.leftJoin(employee, eq(payrollEntries.staffId, employee.id))
						.where(where)
			);
		}

		case 'payroll-receipts': {
			const where = all([
				notDeleted(payrollReceipts),
				inRange(payrollReceipts.paidDate, filters),
				...amountScope(payrollReceipts.amount, filters)
			]);

			return run(
				() =>
					page(
						db
							.select({
								id: payrollReceipts.id,
								paidDate: day(payrollReceipts.paidDate),
								periodStart: day(payrollReceipts.payPeriodStart),
								periodEnd: day(payrollReceipts.payPeriodEnd),
								month: payrollRuns.month,
								year: payrollRuns.year,
								amount: payrollReceipts.amount,
								employees: payrollReceipts.numberOfEmployees,
								receipt: payrollReceipts.recieptLink
							})
							.from(payrollReceipts)
							.leftJoin(payrollRuns, eq(payrollReceipts.payrollRunId, payrollRuns.id))
							.where(where)
							.orderBy(desc(payrollReceipts.paidDate))
					),
				() => db.select({ total: count() }).from(payrollReceipts).where(where)
			);
		}

		case 'salary-changes': {
			const where = all([
				notDeleted(salaries),
				notDeleted(employee),
				inRange(salaries.startDate, filters),
				...amountScope(salaries.amount, filters),
				...scope,
				searchScope(search, [staffName, salaries.changeReason])
			]);

			return run(
				() =>
					page(
						db
							.select({
								id: salaries.id,
								employee: staffName,
								department: department.name,
								position: position.name,
								branch: branch.name,
								amount: salaries.amount,
								transport: salaries.transportationAllowance,
								housing: salaries.housingAllowance,
								positionAllowance: salaries.positionAllowance,
								nonTax: salaries.nonTaxAllowance,
								percentage: salaries.percentage,
								startDate: day(salaries.startDate),
								endDate: day(salaries.endDate),
								changeReason: salaries.changeReason
							})
							.from(salaries)
							.innerJoin(employee, eq(salaries.staffId, employee.id))
							.leftJoin(department, eq(salaries.departmentId, department.id))
							.leftJoin(position, eq(salaries.positionId, position.id))
							.leftJoin(branch, eq(salaries.branchId, branch.id))
							.where(where)
							.orderBy(desc(salaries.startDate))
					),
				() =>
					db
						.select({ total: count() })
						.from(salaries)
						.innerJoin(employee, eq(salaries.staffId, employee.id))
						.where(where)
			);
		}

		case 'employees':
		case 'hires': {
			const where = all([
				notDeleted(employee),
				filters.section === 'hires' ? inRange(employee.hireDate, filters) : undefined,
				...scope,
				searchScope(search, [staffName, employee.idNo, employee.tinNo])
			]);

			return run(
				() =>
					page(
						db
							.select({
								id: employee.id,
								idNo: employee.idNo,
								employee: staffName,
								gender: employee.gender,
								department: department.name,
								position: position.name,
								branch: branch.name,
								status: employmentStatuses.name,
								education: educationalLevel.name,
								maritalStatus: employee.martialStatus,
								hireDate: day(employee.hireDate),
								birthDate: day(employee.birthDate),
								terminationDate: day(employee.terminationDate),
								leavesLeft: employee.leavesLeft,
								// The salary in force today is the open-ended row. A join would
								// duplicate the employee if two were ever left open, and the
								// count query alongside this one does not join, so the row count
								// and the total would stop agreeing. A scalar subquery cannot.
								salary: sql<string>`(
									SELECT ${salaries.amount} FROM ${salaries}
									WHERE ${salaries.staffId} = ${employee.id}
										AND ${salaries.deletedAt} IS NULL
									ORDER BY ${salaries.endDate} IS NULL DESC, ${salaries.startDate} DESC
									LIMIT 1
								)`
							})
							.from(employee)
							.leftJoin(department, eq(employee.departmentId, department.id))
							.leftJoin(position, eq(employee.positionId, position.id))
							.leftJoin(branch, eq(employee.branchId, branch.id))
							.leftJoin(employmentStatuses, eq(employee.employmentStatus, employmentStatuses.id))
							.leftJoin(educationalLevel, eq(employee.educationalLevel, educationalLevel.id))
							.where(where)
							.orderBy(desc(employee.hireDate))
					),
				() => db.select({ total: count() }).from(employee).where(where)
			);
		}

		case 'terminations': {
			const where = all([
				notDeleted(employeeTermination),
				notDeleted(employee),
				inRange(employeeTermination.terminationDate, filters),
				...scope,
				searchScope(search, [staffName, employeeTermination.reason])
			]);

			return run(
				() =>
					page(
						db
							.select({
								id: employeeTermination.id,
								staffId: employee.id,
								employee: staffName,
								gender: employee.gender,
								department: department.name,
								branch: branch.name,
								hireDate: day(employee.hireDate),
								terminationDate: day(employeeTermination.terminationDate),
								tenureYears: sql<string>`ROUND(DATEDIFF(${employeeTermination.terminationDate}, ${employee.hireDate}) / 365.25, 1)`,
								reason: employeeTermination.reason,
								letter: employeeTermination.terminationLetter
							})
							.from(employeeTermination)
							.innerJoin(employee, eq(employeeTermination.staffId, employee.id))
							.leftJoin(department, eq(employee.departmentId, department.id))
							.leftJoin(branch, eq(employee.branchId, branch.id))
							.where(where)
							.orderBy(desc(employeeTermination.terminationDate))
					),
				() =>
					db
						.select({ total: count() })
						.from(employeeTermination)
						.innerJoin(employee, eq(employeeTermination.staffId, employee.id))
						.where(where)
			);
		}

		case 'bonuses': {
			const where = all([
				notDeleted(bonuses),
				notDeleted(employee),
				inRange(bonuses.bonusDate, filters),
				...amountScope(bonuses.amount, filters),
				...scope,
				searchScope(search, [staffName, bonuses.description])
			]);

			return run(
				() =>
					page(
						db
							.select({
								id: bonuses.id,
								date: day(bonuses.bonusDate),
								employee: staffName,
								department: department.name,
								branch: branch.name,
								amount: bonuses.amount,
								description: bonuses.description
							})
							.from(bonuses)
							.innerJoin(employee, eq(bonuses.staffId, employee.id))
							.leftJoin(department, eq(employee.departmentId, department.id))
							.leftJoin(branch, eq(employee.branchId, branch.id))
							.where(where)
							.orderBy(desc(bonuses.bonusDate))
					),
				() =>
					db
						.select({ total: count() })
						.from(bonuses)
						.innerJoin(employee, eq(bonuses.staffId, employee.id))
						.where(where)
			);
		}

		case 'overtime': {
			const where = all([
				notDeleted(overTime),
				notDeleted(employee),
				inRange(overTime.date, filters),
				filters.overtimeTypeId ? eq(overTime.overTimeTypeId, filters.overtimeTypeId) : undefined,
				...amountScope(overTime.total, filters),
				...scope,
				searchScope(search, [staffName, overTime.reason])
			]);

			return run(
				() =>
					page(
						db
							.select({
								id: overTime.id,
								date: day(overTime.date),
								employee: staffName,
								department: department.name,
								branch: branch.name,
								type: overTimeType.name,
								hours: overTime.hours,
								rate: overTime.amountPerHour,
								amount: overTime.total,
								reason: overTime.reason
							})
							.from(overTime)
							.innerJoin(employee, eq(overTime.staffId, employee.id))
							.leftJoin(department, eq(employee.departmentId, department.id))
							.leftJoin(branch, eq(employee.branchId, branch.id))
							.leftJoin(overTimeType, eq(overTime.overTimeTypeId, overTimeType.id))
							.where(where)
							.orderBy(desc(overTime.date))
					),
				() =>
					db
						.select({ total: count() })
						.from(overTime)
						.innerJoin(employee, eq(overTime.staffId, employee.id))
						.where(where)
			);
		}

		case 'deductions': {
			const where = all([
				notDeleted(deductions),
				notDeleted(employee),
				inRange(deductions.deductionDate, filters),
				...amountScope(deductions.amount, filters),
				...scope,
				searchScope(search, [staffName, deductions.reason, deductions.type])
			]);

			return run(
				() =>
					page(
						db
							.select({
								id: deductions.id,
								date: day(deductions.deductionDate),
								employee: staffName,
								department: department.name,
								type: deductions.type,
								amount: deductions.amount,
								reason: deductions.reason,
								warningType: deductions.warningType,
								warningReason: deductions.warningReason
							})
							.from(deductions)
							.innerJoin(employee, eq(deductions.staffId, employee.id))
							.leftJoin(department, eq(employee.departmentId, department.id))
							.where(where)
							.orderBy(desc(deductions.deductionDate))
					),
				() =>
					db
						.select({ total: count() })
						.from(deductions)
						.innerJoin(employee, eq(deductions.staffId, employee.id))
						.where(where)
			);
		}

		case 'attendance': {
			const where = all([
				notDeleted(missingDays),
				notDeleted(employee),
				inRange(missingDays.day, filters),
				filters.approvalStatus
					? sql`${missingDays.approval} = ${filters.approvalStatus}`
					: undefined,
				...scope,
				searchScope(search, [staffName, missingDays.reason])
			]);

			return run(
				() =>
					page(
						db
							.select({
								id: missingDays.id,
								date: day(missingDays.day),
								employee: staffName,
								department: department.name,
								branch: branch.name,
								deductable: sql<string>`IF(${missingDays.deductable}, 'yes', 'no')`,
								amount: missingDays.deductableAmount,
								approval: missingDays.approval,
								reason: missingDays.reason
							})
							.from(missingDays)
							.innerJoin(employee, eq(missingDays.staffId, employee.id))
							.leftJoin(department, eq(employee.departmentId, department.id))
							.leftJoin(branch, eq(employee.branchId, branch.id))
							.where(where)
							.orderBy(desc(missingDays.day))
					),
				() =>
					db
						.select({ total: count() })
						.from(missingDays)
						.innerJoin(employee, eq(missingDays.staffId, employee.id))
						.where(where)
			);
		}

		case 'leaves': {
			const where = all([
				notDeleted(leave),
				notDeleted(employee),
				inRange(leave.startDate, filters),
				filters.leaveTypeId ? eq(leave.leaveTypeId, filters.leaveTypeId) : undefined,
				filters.approvalStatus ? sql`${leave.status} = ${filters.approvalStatus}` : undefined,
				...scope,
				searchScope(search, [staffName, leave.reason])
			]);

			return run(
				() =>
					page(
						db
							.select({
								id: leave.id,
								employee: staffName,
								department: department.name,
								leaveType: leaveType.name,
								requestDate: day(leave.requestDate),
								startDate: day(leave.startDate),
								endDate: day(leave.endDate),
								days: leave.days,
								status: leave.status,
								approvedBy: user.name,
								reason: leave.reason
							})
							.from(leave)
							.innerJoin(employee, eq(leave.staffId, employee.id))
							.leftJoin(department, eq(employee.departmentId, department.id))
							.leftJoin(leaveType, eq(leave.leaveTypeId, leaveType.id))
							.leftJoin(user, eq(leave.approvedBy, user.id))
							.where(where)
							.orderBy(desc(leave.startDate))
					),
				() =>
					db
						.select({ total: count() })
						.from(leave)
						.innerJoin(employee, eq(leave.staffId, employee.id))
						.where(where)
			);
		}

		case 'leave-grants': {
			const where = all([
				notDeleted(employeeLeaveGrant),
				notDeleted(employee),
				inRange(employeeLeaveGrant.grantDate, filters),
				...scope,
				searchScope(search, [staffName])
			]);

			return run(
				() =>
					page(
						db
							.select({
								id: employeeLeaveGrant.id,
								employee: staffName,
								department: department.name,
								serviceYear: employeeLeaveGrant.serviceYear,
								grantDate: day(employeeLeaveGrant.grantDate),
								expiryDate: day(employeeLeaveGrant.expiryDate),
								granted: employeeLeaveGrant.daysGranted,
								used: employeeLeaveGrant.daysUsed,
								remaining: sql<string>`${employeeLeaveGrant.daysGranted} - ${employeeLeaveGrant.daysUsed}`,
								status: employeeLeaveGrant.status
							})
							.from(employeeLeaveGrant)
							.innerJoin(employee, eq(employeeLeaveGrant.staffId, employee.id))
							.leftJoin(department, eq(employee.departmentId, department.id))
							.where(where)
							.orderBy(desc(employeeLeaveGrant.grantDate))
					),
				() =>
					db
						.select({ total: count() })
						.from(employeeLeaveGrant)
						.innerJoin(employee, eq(employeeLeaveGrant.staffId, employee.id))
						.where(where)
			);
		}

		case 'supply-adjustments': {
			const where = all([
				notDeleted(suppliesAdjustments),
				inRange(suppliesAdjustments.createdAt, filters),
				filters.supplierId ? eq(suppliesAdjustments.supplierId, filters.supplierId) : undefined,
				filters.supplyTypeId ? eq(supplies.supplyTypeId, filters.supplyTypeId) : undefined,
				filters.staffId ? eq(suppliesAdjustments.employeeResponsible, filters.staffId) : undefined,
				searchScope(search, [supplies.name, suppliesAdjustments.reason])
			]);

			return run(
				() =>
					page(
						db
							.select({
								id: suppliesAdjustments.id,
								date: day(suppliesAdjustments.createdAt),
								supply: supplies.name,
								supplyType: supplyTypes.name,
								direction: sql<string>`IF(${suppliesAdjustments.adjustment} > 0, 'in', 'out')`,
								adjustment: suppliesAdjustments.adjustment,
								costPerItem: suppliesAdjustments.costPerItem,
								total: suppliesAdjustments.total,
								supplier: supplySuppliers.name,
								employee: staffName,
								reason: suppliesAdjustments.reason
							})
							.from(suppliesAdjustments)
							.leftJoin(supplies, eq(suppliesAdjustments.suppliesId, supplies.id))
							.leftJoin(supplyTypes, eq(supplies.supplyTypeId, supplyTypes.id))
							.leftJoin(supplySuppliers, eq(suppliesAdjustments.supplierId, supplySuppliers.id))
							.leftJoin(employee, eq(suppliesAdjustments.employeeResponsible, employee.id))
							.where(where)
							.orderBy(desc(suppliesAdjustments.createdAt))
					),
				() =>
					db
						.select({ total: count() })
						.from(suppliesAdjustments)
						.leftJoin(supplies, eq(suppliesAdjustments.suppliesId, supplies.id))
						.where(where)
			);
		}

		case 'damaged-supplies': {
			const where = all([
				notDeleted(damagedSupplies),
				inRange(damagedSupplies.createdAt, filters),
				filters.supplyTypeId ? eq(supplies.supplyTypeId, filters.supplyTypeId) : undefined,
				filters.staffId ? eq(damagedSupplies.damagedBy, filters.staffId) : undefined,
				searchScope(search, [supplies.name, damagedSupplies.reason])
			]);

			return run(
				() =>
					page(
						db
							.select({
								id: damagedSupplies.id,
								date: day(damagedSupplies.createdAt),
								supply: supplies.name,
								supplyType: supplyTypes.name,
								quantity: damagedSupplies.quantity,
								employee: staffName,
								deductable: sql<string>`IF(${damagedSupplies.deductable}, 'yes', 'no')`,
								reason: damagedSupplies.reason
							})
							.from(damagedSupplies)
							.leftJoin(supplies, eq(damagedSupplies.supplyId, supplies.id))
							.leftJoin(supplyTypes, eq(supplies.supplyTypeId, supplyTypes.id))
							.leftJoin(employee, eq(damagedSupplies.damagedBy, employee.id))
							.where(where)
							.orderBy(desc(damagedSupplies.createdAt))
					),
				() =>
					db
						.select({ total: count() })
						.from(damagedSupplies)
						.leftJoin(supplies, eq(damagedSupplies.supplyId, supplies.id))
						.where(where)
			);
		}

		case 'stock': {
			const where = all([
				notDeleted(supplies),
				filters.supplyTypeId ? eq(supplies.supplyTypeId, filters.supplyTypeId) : undefined,
				searchScope(search, [supplies.name, supplies.description])
			]);

			return run(
				() =>
					page(
						db
							.select({
								id: supplies.id,
								supply: supplies.name,
								supplyType: supplyTypes.name,
								quantity: onHand(),
								unitOfMeasure: supplies.unitOfMeasure,
								reorderLevel: supplies.reorderLevel,
								belowReorder: sql<string>`IF(${supplies.reorderLevel} IS NOT NULL AND ${onHand()} <= ${supplies.reorderLevel}, 'yes', 'no')`,
								description: supplies.description
							})
							.from(supplies)
							.leftJoin(supplyTypes, eq(supplies.supplyTypeId, supplyTypes.id))
							.where(where)
							.orderBy(onHand())
					),
				() => db.select({ total: count() }).from(supplies).where(where)
			);
		}

		case 'transactions': {
			const where = all([
				notDeleted(transactions),
				inRange(transactions.createdAt, filters),
				filters.paymentMethodId
					? eq(transactions.paymentMethodId, filters.paymentMethodId)
					: undefined,
				filters.transactionStatus
					? sql`${transactions.paymentStatus} = ${filters.transactionStatus}`
					: undefined,
				...amountScope(transactions.amount, filters),
				searchScope(search, [transactions.description])
			]);

			return run(
				() =>
					page(
						db
							.select({
								id: transactions.id,
								date: day(transactions.createdAt),
								description: transactions.description,
								amount: transactions.amount,
								paymentStatus: transactions.paymentStatus,
								paymentMethod: paymentMethods.name,
								recordedBy: user.name,
								receipt: transactions.recieptLink
							})
							.from(transactions)
							.leftJoin(paymentMethods, eq(transactions.paymentMethodId, paymentMethods.id))
							.leftJoin(user, eq(transactions.createdBy, user.id))
							.where(where)
							.orderBy(desc(transactions.createdAt))
					),
				() => db.select({ total: count() }).from(transactions).where(where)
			);
		}

		case 'expenses': {
			const where = all([
				notDeleted(expenses),
				inRange(expenses.expenseDate, filters),
				filters.expenseTypeId ? eq(expenses.type, filters.expenseTypeId) : undefined,
				filters.paymentMethodId
					? eq(transactions.paymentMethodId, filters.paymentMethodId)
					: undefined,
				...amountScope(expenses.total, filters),
				searchScope(search, [expenses.description, expensesType.name])
			]);

			return run(
				() =>
					page(
						db
							.select({
								id: expenses.id,
								date: day(expenses.expenseDate),
								type: expensesType.name,
								description: expenses.description,
								amount: expenses.total,
								paymentMethod: paymentMethods.name,
								paymentStatus: transactions.paymentStatus,
								recordedBy: user.name,
								receipt: transactions.recieptLink
							})
							.from(expenses)
							.leftJoin(expensesType, eq(expenses.type, expensesType.id))
							.leftJoin(
								transactions,
								and(eq(expenses.transactionId, transactions.id), notDeleted(transactions))
							)
							.leftJoin(paymentMethods, eq(transactions.paymentMethodId, paymentMethods.id))
							.leftJoin(user, eq(expenses.createdBy, user.id))
							.where(where)
							.orderBy(desc(expenses.expenseDate))
					),
				() =>
					db
						.select({ total: count() })
						.from(expenses)
						.leftJoin(expensesType, eq(expenses.type, expensesType.id))
						.leftJoin(
							transactions,
							and(eq(expenses.transactionId, transactions.id), notDeleted(transactions))
						)
						.where(where)
			);
		}

		case 'services-rendered': {
			// Billed work, read from bills (`billedLines.server.ts`) — no longer `transaction_services`.
			const lines = billedLines(
				filters,
				searchScope(search, [services.name, invoiceLine.description, staffName])
			);

			return run(
				() =>
					page(
						db
							.select({
								id: lines.id,
								date: day(lines.issuedOn),
								bill: lines.bill,
								service: lines.service,
								employee: lines.clinician,
								quantity: lines.quantity,
								price: lines.unitPrice,
								total: lines.lineTotal,
								paymentStatus: lines.status
							})
							.from(lines)
							.orderBy(desc(lines.issuedOn), desc(lines.id))
					),
				() => db.select({ total: count() }).from(lines)
			);
		}

		case 'customers': {
			const where = all([
				notDeleted(customers),
				filters.customerId ? eq(customers.id, filters.customerId) : undefined,
				searchScope(search, [customers.name, customers.phone, customers.email, customers.tinNo])
			]);

			return run(
				() =>
					page(
						db
							.select({
								id: customers.id,
								customer: customers.name,
								status: customers.status,
								phone: customers.phone,
								email: customers.email,
								tinNo: customers.tinNo,
								addedOn: day(customers.createdAt)
							})
							.from(customers)
							.where(where)
							.orderBy(desc(customers.createdAt))
					),
				() => db.select({ total: count() }).from(customers).where(where)
			);
		}

		case 'branches': {
			const where = all([
				notDeleted(branch),
				filters.branchId ? eq(branch.id, filters.branchId) : undefined,
				searchScope(search, [branch.name, branch.phone])
			]);

			return run(
				() =>
					page(
						db
							.select({
								id: branch.id,
								branch: branch.name,
								phone: branch.phone,
								openedOn: day(branch.openedOn),
								isActive: sql<string>`IF(${branch.isActive}, 'active', 'inactive')`
							})
							.from(branch)
							.where(where)
							.orderBy(desc(branch.openedOn))
					),
				() => db.select({ total: count() }).from(branch).where(where)
			);
		}

		case 'audit-log': {
			const where = all([
				inRange(auditLog.timestamp, filters),
				searchScope(search, [auditLog.tableName, auditLog.action, auditLog.recordId, user.name])
			]);

			return run(
				() =>
					page(
						db
							.select({
								id: auditLog.id,
								at: sql<string>`DATE_FORMAT(${auditLog.timestamp}, '%Y-%m-%d %H:%i')`,
								user: user.name,
								action: auditLog.action,
								tableName: auditLog.tableName,
								recordId: auditLog.recordId,
								ipAddress: auditLog.ipAddress
							})
							.from(auditLog)
							.leftJoin(user, eq(auditLog.userId, user.id))
							.where(where)
							.orderBy(desc(auditLog.timestamp))
					),
				() =>
					db
						.select({ total: count() })
						.from(auditLog)
						.leftJoin(user, eq(auditLog.userId, user.id))
						.where(where)
			);
		}

		case 'patient-access': {
			// The access log reads through its own module (`server/accessLog.ts`), which owns what a
			// view row is; here it is only paged and labelled for the table.
			const where = accessLogWhere(
				{ from: clinicDayRange(filters.dateStart).start, to: clinicDayRange(filters.dateEnd).end },
				search
			);
			const [rows, total] = await Promise.all([
				accessLogPage(where, filters.pageSize, offset),
				accessLogCount(where)
			]);
			return {
				rows: rows.map((r) => ({
					id: r.id,
					at: r.viewedAt,
					user: r.user ?? 'Deleted user',
					patientId: r.patientId,
					patient: r.patient,
					part: VIEWED_RECORD_LABEL[r.recordType] ?? r.recordType,
					action: VIEW_ACTION_LABEL[r.action] ?? r.action,
					branch: r.branch,
					ipAddress: r.ipAddress
				})),
				total
			};
		}

		case 'payroll-runs':
		default: {
			const where = all([
				notDeleted(payrollRuns),
				inRange(payrollRuns.createdAt, filters),
				searchScope(search, [payrollRuns.month])
			]);

			return run(
				() =>
					page(
						db
							.select({
								id: payrollRuns.id,
								month: payrollRuns.month,
								year: payrollRuns.year,
								totalSalaries: payrollRuns.totalSalaries,
								totalOvertime: payrollRuns.totalOvertime,
								totalTransport: payrollRuns.totalTransport,
								totalHousing: payrollRuns.totalHousing,
								totalPosition: payrollRuns.totalPosition,
								totalGross: payrollRuns.totalGross,
								totalTax: payrollRuns.totalTax,
								totalDeductions: payrollRuns.totalDeductions,
								totalPenalities: payrollRuns.totalPenalities,
								penEm: payrollRuns.penEm,
								penOrg: payrollRuns.penOrg,
								totalNet: payrollRuns.totalNet,
								finalized: sql<string>`IF(${payrollRuns.finalized}, 'yes', 'no')`,
								finalizedAt: day(payrollRuns.finalizedAt),
								finalizedBy: user.name
							})
							.from(payrollRuns)
							.leftJoin(user, eq(payrollRuns.finalizedByUserId, user.id))
							.where(where)
							.orderBy(desc(payrollRuns.year), desc(payrollRuns.createdAt))
					),
				() => db.select({ total: count() }).from(payrollRuns).where(where)
			);
		}
	}
}

/** Everything the query builder's dropdowns need, fetched once per page load. */
export async function filterOptions() {
	const [
		departments,
		positions,
		branches,
		customerList,
		statuses,
		educations,
		methods,
		expenseTypes,
		supplyTypeList,
		suppliers,
		serviceList,
		leaveTypes,
		overtimeTypes,
		staff
	] = await Promise.all([
		db
			.select({ id: department.id, name: department.name })
			.from(department)
			.where(notDeleted(department))
			.orderBy(department.name),
		db
			.select({ id: position.id, name: position.name })
			.from(position)
			.where(notDeleted(position))
			.orderBy(position.name),
		db
			.select({ id: branch.id, name: branch.name })
			.from(branch)
			.where(notDeleted(branch))
			.orderBy(branch.name),
		db
			.select({ id: customers.id, name: customers.name })
			.from(customers)
			.where(notDeleted(customers))
			.orderBy(customers.name),
		db
			.select({ id: employmentStatuses.id, name: employmentStatuses.name })
			.from(employmentStatuses)
			.where(notDeleted(employmentStatuses))
			.orderBy(employmentStatuses.name),
		db
			.select({ id: educationalLevel.id, name: educationalLevel.name })
			.from(educationalLevel)
			.where(notDeleted(educationalLevel))
			.orderBy(educationalLevel.name),
		db
			.select({ id: paymentMethods.id, name: paymentMethods.name })
			.from(paymentMethods)
			.where(notDeleted(paymentMethods))
			.orderBy(paymentMethods.name),
		db
			.select({ id: expensesType.id, name: expensesType.name })
			.from(expensesType)
			.where(notDeleted(expensesType))
			.orderBy(expensesType.name),
		db
			.select({ id: supplyTypes.id, name: supplyTypes.name })
			.from(supplyTypes)
			.where(notDeleted(supplyTypes))
			.orderBy(supplyTypes.name),
		db
			.select({ id: supplySuppliers.id, name: supplySuppliers.name })
			.from(supplySuppliers)
			.where(notDeleted(supplySuppliers))
			.orderBy(supplySuppliers.name),
		db
			.select({ id: services.id, name: services.name })
			.from(services)
			.where(notDeleted(services))
			.orderBy(services.name),
		db
			.select({ id: leaveType.id, name: leaveType.name })
			.from(leaveType)
			.where(notDeleted(leaveType))
			.orderBy(leaveType.name),
		db
			.select({ id: overTimeType.id, name: overTimeType.name })
			.from(overTimeType)
			.where(notDeleted(overTimeType))
			.orderBy(overTimeType.name),
		db
			.select({ id: employee.id, name: staffName })
			.from(employee)
			.where(all([notDeleted(employee), isNotNull(employee.name)]))
			.orderBy(employee.name)
			.limit(2000)
	]);

	return {
		departments,
		positions,
		branches,
		customers: customerList,
		employmentStatuses: statuses,
		educationalLevels: educations,
		paymentMethods: methods,
		expenseTypes,
		supplyTypes: supplyTypeList,
		suppliers,
		services: serviceList,
		leaveTypes,
		overtimeTypes,
		staff
	};
}
