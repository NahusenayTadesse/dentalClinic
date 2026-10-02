import { superValidate, message, setError } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { salaryChangeSchema as schema } from './schema';

import { db } from '$lib/server/db';
import { employee, salaries } from '$lib/server/db/schema';
import { asRequested } from '$lib/server/approvals';
import type { Actions, PageServerLoad } from './$types';
import { setFlash } from 'sveltekit-flash-message/server';
import { and, eq, isNull } from 'drizzle-orm';
import { branches, departments, positions } from '$lib/server/fastData';
import { employeeFullName } from '$lib/server/employeeName';
import { addClinicDays, clinicToday } from '$lib/clinicTime';
/**
 * Changing an employee's salary, allowances or placement. The form opens on what they are paid now:
 * the open salary row, read here — it used to come from a sibling page's layout, which loaded a
 * payslip form this page never used.
 */
export const load: PageServerLoad = async ({ parent, params }) => {
	const { staffMember } = await parent();
	const [current] = await db
		.select({
			name: employeeFullName,
			baseSalary: salaries.amount,
			housingAllowance: salaries.housingAllowance,
			transportationAllowance: salaries.transportationAllowance,
			nonTaxAllowance: salaries.nonTaxAllowance,
			positionAllowance: salaries.positionAllowance
		})
		.from(employee)
		.leftJoin(salaries, and(eq(salaries.staffId, employee.id), isNull(salaries.endDate)))
		.where(eq(employee.id, Number(params.id)));

	const form = await superValidate(
		{
			branch: staffMember?.branchId ?? undefined,
			department: staffMember?.departmentId ?? undefined,
			position: staffMember?.positionId ?? undefined,
			amount: Number(current?.baseSalary ?? 0),
			housingAllowance: Number(current?.housingAllowance ?? 0),
			transportationAllowance: Number(current?.transportationAllowance ?? 0),
			nonTaxAllowance: Number(current?.nonTaxAllowance ?? 0),
			positionAllowance: Number(current?.positionAllowance ?? 0)
		},
		zod4(schema),
		{ errors: false }
	);

	return {
		form,
		name: current?.name ?? '',
		currentSalary: Number(current?.baseSalary ?? 0),
		branches: await branches(),
		departments: await departments(),
		positions: await positions()
	};
};

export const actions: Actions = {
	/**
	 * Requests a new salary (and placement) for the employee. The row goes in pending; the previous
	 * one stays open until it is approved, so the employee keeps earning at the old rate meanwhile —
	 * the salaries `onApprove` hook in `$lib/server/approvals` closes it.
	 */
	changeSalary: async ({ request, cookies, params, locals }) => {
		const staffId = Number(params.id);
		const form = await superValidate(request, zod4(schema));
		if (!form.valid) {
			return message(form, { type: 'error', text: 'Please check the form.' }, { status: 400 });
		}

		const { branch, department, position, amount, officeCommission, percentage, date } = form.data;

		// Refused before anything is written. The check used to run inside the transaction and only
		// set a message, so a salary dated too far back was saved anyway with an error toast over it.
		if (date < addClinicDays(clinicToday(), -30)) {
			return setError(form, 'date', 'The new salary cannot start more than 30 days ago');
		}

		try {
			await db.transaction(async (tx) => {
				// `salaries` keeps its money as decimal strings (it predates `mode: 'number'`).
				await tx.insert(salaries).values({
					...asRequested(locals.user?.id),
					staffId,
					departmentId: department,
					branchId: branch,
					positionId: position,
					officeCommission,
					percentage: String(percentage),
					changeReason: form.data.changeReason || null,
					amount: String(amount),
					transportationAllowance: String(form.data.transportationAllowance),
					nonTaxAllowance: String(form.data.nonTaxAllowance),
					positionAllowance: String(form.data.positionAllowance),
					housingAllowance: String(form.data.housingAllowance),
					startDate: date,
					createdBy: locals.user?.id
				});

				await tx
					.update(employee)
					.set({ departmentId: department, branchId: branch, positionId: position })
					.where(eq(employee.id, staffId));
			});
		} catch (err: unknown) {
			// Loud in the log, quiet to the client (CLAUDE.md §9).
			console.error('salary change failed', err);
			setFlash({ type: 'error', message: 'The salary could not be changed.' }, cookies);
			return message(
				form,
				{ type: 'error', text: 'The salary could not be changed.' },
				{ status: 500 }
			);
		}

		setFlash({ type: 'success', message: 'New salary sent for approval.' }, cookies);
		return message(form, { type: 'success', text: 'New salary sent for approval.' });
	}
};
