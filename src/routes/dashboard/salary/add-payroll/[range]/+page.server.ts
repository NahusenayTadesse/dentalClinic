import { db } from '$lib/server/db';
import { payrollRuns, payrollReceipts, payrollEntries, transactions } from '$lib/server/db/schema';
import { asRequested, unapprovedEmployeeIds } from '$lib/server/approvals';
import { and, eq, sql } from 'drizzle-orm';
import { paymentMethods as paymentMethodList } from '$lib/server/fastData';
import { payrollPeriod, payslips, type Payslip } from '$lib/server/payrollRun';
import { saveUploadedFile } from '$lib/server/upload';
import { unrecordedAbsences } from '$lib/server/attendance';
import { clinicToday } from '$lib/clinicTime';

import { payrollSchema } from './schema';
import type { PageServerLoad, Actions } from './$types';
import { superValidate, message } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';

/**
 * Running payroll for one month: the page lists every unpaid payslip, and the action pays the ones
 * ticked. Both read `payslips` (`server/payrollRun.ts`) — the page to show the figures, the action
 * to recompute them in its own transaction rather than write what the browser posts back.
 */
export const load: PageServerLoad = async ({ params, locals }) => {
	const range = params.range;
	const period = payrollPeriod(range);
	const today = clinicToday();
	const [form, payrollData, methods, unrecorded] = await Promise.all([
		superValidate({ month: range }, zod4(payrollSchema), { errors: false }),
		payslips(period),
		paymentMethodList(),
		// Working days with nothing on the register are deducted as absences; say so before paying,
		// so a forgotten tick is caught here rather than on someone's payslip.
		period.start <= today
			? unrecordedAbsences(period.start, period.end < today ? period.end : today, locals.branch)
			: Promise.resolve([])
	]);
	return {
		month: range,
		// Decimals arrive as strings from the driver; the table sums and sorts numbers.
		payrollData: payrollData.map((row) => ({
			...row,
			basicSalary: Number(row.basicSalary ?? 0),
			positionAllowance: Number(row.positionAllowance ?? 0),
			housingAllowance: Number(row.housingAllowance ?? 0),
			transportAllowance: Number(row.transportAllowance ?? 0),
			nonTaxable: Number(row.nonTaxable ?? 0),
			attendancePenality: Number(row.attendancePenality ?? 0),
			overtime: Number(row.overtime ?? 0),
			bonus: Number(row.bonus ?? 0),
			commission: Number(row.commission ?? 0),
			absent: Number(row.absent ?? 0),
			deductions: Number(row.deductions ?? 0),
			gross: Number(row.gross ?? 0),
			taxable: Number(row.taxable ?? 0),
			taxAmount: Number(row.taxAmount ?? 0),
			penEm: Number(row.penEm ?? 0),
			penOrg: Number(row.penOrg ?? 0),
			netPay: Number(row.netPay ?? 0)
		})),
		form,
		paymentMethods: methods,
		unrecorded
	};
};

/** A decimal column's value: two places, as a string, never a float's long tail. */
function money(value: unknown): string {
	return (Math.round(Number(value ?? 0) * 100) / 100).toFixed(2);
}

/** A total over recomputed payslips, to the cent. */
function total(rows: Payslip[], pick: (row: Payslip) => unknown): number {
	return Math.round(rows.reduce((sum, row) => sum + Number(pick(row) ?? 0), 0) * 100) / 100;
}

/** Thrown inside the transaction when the selection is not what the server would pay. */
class StaleSelection extends Error {}

export const actions: Actions = {
	/**
	 * Pays the ticked employees. From the browser it takes who, from which account, on which day,
	 * and the receipt; every amount is recomputed here, inside the transaction that pays it. A
	 * selection the server would not pay — someone paid meanwhile, deactivated, or unapproved — is
	 * refused whole rather than paid in part.
	 */
	runPayroll: async ({ request, locals, params }) => {
		const form = await superValidate(request, zod4(payrollSchema));
		if (!form.valid) {
			return message(form, { type: 'error', text: 'Check the form.' }, { status: 400 });
		}
		const { staffIds: chosen, paymentMethod, reciept, month, paymentDate } = form.data;
		const range = params.range;

		// The figures on the page are this route's month. Filing them under another chosen in the
		// form would pay one month's amounts as another's.
		if (month !== range) {
			return message(
				form,
				{ type: 'error', text: 'Open the payroll page for that month to pay it.' },
				{ status: 400 }
			);
		}
		const period = payrollPeriod(range);
		const staffIds = [...new Set(chosen)];
		if (!staffIds.length) {
			return message(form, { type: 'error', text: 'Choose who to pay.' }, { status: 400 });
		}

		const blocked = await unapprovedEmployeeIds(staffIds);
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

		try {
			const recieptLink = reciept ? await saveUploadedFile(reciept) : null;
			const paid = await db.transaction(async (tx) => {
				// What the server pays, computed now — not what the page showed when it loaded.
				const slips = await payslips(period, { staffIds, reader: tx });
				if (slips.length !== staffIds.length) {
					throw new StaleSelection(
						`${staffIds.length - slips.length} of the selected employees have been paid for this month or can no longer be paid. Reload the page and try again.`
					);
				}
				const net = total(slips, (s) => s.netPay);

				let payrollId: number;
				const [existing] = await tx
					.select({ id: payrollRuns.id })
					.from(payrollRuns)
					.where(and(eq(payrollRuns.month, period.month), eq(payrollRuns.year, period.year)));

				if (existing) {
					payrollId = existing.id;
				} else {
					const [created] = await tx
						.insert(payrollRuns)
						.values({
							...asRequested(locals?.user?.id),
							month: period.month,
							year: period.year,
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
					payrollId = created.id;
				}

				// A month may be paid in several runs; each adds its own payslips to the totals.
				await tx
					.update(payrollRuns)
					.set({
						totalNet: sql`${payrollRuns.totalNet} + ${net}`,
						totalGross: sql`${payrollRuns.totalGross} + ${total(slips, (s) => s.gross)}`,
						totalTransport: sql`${payrollRuns.totalTransport} + ${total(slips, (s) => s.transportAllowance)}`,
						totalHousing: sql`${payrollRuns.totalHousing} + ${total(slips, (s) => s.housingAllowance)}`,
						totalPosition: sql`${payrollRuns.totalPosition} + ${total(slips, (s) => s.positionAllowance)}`,
						totalDeductions: sql`${payrollRuns.totalDeductions} + ${total(slips, (s) => s.deductions)}`,
						totalPenalities: sql`${payrollRuns.totalPenalities} + ${total(slips, (s) => s.attendancePenality)}`,
						totalTax: sql`${payrollRuns.totalTax} + ${total(slips, (s) => s.taxAmount)}`,
						penEm: sql`${payrollRuns.penEm} + ${total(slips, (s) => s.penEm)}`,
						penOrg: sql`${payrollRuns.penOrg} + ${total(slips, (s) => s.penOrg)}`,
						updatedBy: locals?.user?.id
					})
					.where(eq(payrollRuns.id, payrollId));

				const [transaction] = await tx
					.insert(transactions)
					.values({
						paymentMethodId: paymentMethod,
						amount: net,
						direction: 'out',
						recieptLink,
						description: 'Employees salary payment',
						createdBy: locals?.user?.id
					})
					.$returningId();

				await tx.insert(payrollReceipts).values({
					payrollRunId: payrollId,
					numberOfEmployees: slips.length,
					payPeriodStart: period.start,
					payPeriodEnd: period.end,
					paidDate: paymentDate,
					amount: money(net),
					recieptLink,
					transactionId: transaction.id,
					createdBy: locals?.user?.id
				});

				await tx.insert(payrollEntries).values(
					slips.map((s) => ({
						payrollId,
						staffId: s.id,
						month: period.month,
						year: period.year,
						payPeriodStart: period.start,
						payPeriodEnd: period.end,
						basicSalary: money(s.basicSalary),
						overtimeAmount: money(s.overtime),
						deductions: money(s.deductions),
						commissionAmount: money(s.commission),
						bonusAmount: money(s.bonus),
						allowances: '0',
						transportAllowance: money(s.transportAllowance),
						positionAllowance: money(s.positionAllowance),
						housingAllowance: money(s.housingAllowance),
						nonTaxableAllowance: money(s.nonTaxable),
						grossAmount: money(s.gross),
						netAmount: money(s.netPay),
						paidAmount: money(s.netPay),
						attendancePenality: money(s.attendancePenality),
						taxAmount: money(s.taxAmount),
						penEm: money(s.penEm),
						penOrg: money(s.penOrg),
						status: 'paid' as const,
						paymentMethodId: s.paymentMethodId ?? null,
						createdBy: locals?.user?.id,
						recieptLink,
						notes: 'Salary Paid',
						paymentDate
					}))
				);
				return slips.length;
			});

			// Outside the transaction. It was returned from inside the callback, which only makes it
			// the transaction's result: the action itself returned nothing, and a run that had paid
			// everyone never said so.
			return message(form, { type: 'success', text: `Paid ${paid} employees.` });
		} catch (err: unknown) {
			if (err instanceof StaleSelection) {
				return message(form, { type: 'error', text: err.message }, { status: 409 });
			}
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
