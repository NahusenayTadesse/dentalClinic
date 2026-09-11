import { superValidate, message } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { addLeavePayrollSchema as schema } from './schema';

import { db } from '$lib/server/db';
import { payrollEntries } from '$lib/server/db/schema';
import type { Actions } from './$types';
import { fail } from 'sveltekit-superforms';
import { setFlash } from 'sveltekit-flash-message/server';
import { saveUploadedFile } from '$lib/server/upload';

export const actions: Actions = {
	addSalary: async ({ request, cookies, params, locals }) => {
		console.log('Connected');

		const { id } = params;
		const form = await superValidate(request, zod4(schema));

		if (!form.valid) {
			// Stay on the same page and set a flash message
			setFlash({ type: 'error', message: 'Please check your form data.' }, cookies);

			return fail(400, { form });
		}

		const {
			monthYear,
			payPeriodStart, // ISO date string  YYYY-MM-DD
			payPeriodEnd,
			baseSalary, // decimal as string
			overtime,
			deductions,
			commissions,
			bonus,
			netAmount,
			paidAmount,
			taxAmount,
			paymentMethod,
			paymentDate,
			notes,
			reciept
		} = form.data;

		try {
			const recieptLink = await saveUploadedFile(reciept);
			delete form?.data?.reciept;

			const [month, year] = monthYear.split('_');

			await db.insert(payrollEntries).values({
				staffId: Number(id),
				month,
				year,
				payPeriodStart: new Date(payPeriodStart), // ISO date string  YYYY-MM-DD
				payPeriodEnd: new Date(payPeriodEnd),
				basicSalary: baseSalary.toString(), // decimal as string
				overtimeAmount: overtime?.toString(),
				deductions: deductions?.toString(),
				commissionAmount: commissions?.toString(),
				bonusAmount: bonus?.toString(),
				netAmount: netAmount.toString(),
				paidAmount: paidAmount.toString(),
				taxAmount: taxAmount?.toString(),
				paymentMethodId: paymentMethod,
				paymentDate: new Date(paymentDate),
				notes,
				recieptLink,
				createdBy: locals.user?.id,
				status: 'paid'
			});

			/*
			 * The daily `reports` rollup this used to bump is gone. It held twelve figures of
			 * which two were ever written and none were ever read, and every one of them is a
			 * join away from the rows that actually record the events — so the number is derived
			 * when a report asks for it rather than accumulated here and trusted later.
			 */

			// Stay on the same page and set a flash message
			setFlash({ type: 'success', message: 'Salary Record Successuflly Added' }, cookies);
			return message(form, { type: 'success', text: 'Salary Record Successuflly Added' });
		} catch (err) {
			setFlash(
				{ type: 'error', message: 'An Error occured while adding Salary ' + err?.message },
				cookies
			);
			return message(form, {
				type: 'error',
				text: 'An Error occured while adding Salary ' + err?.message
			});
		}
	}
};
