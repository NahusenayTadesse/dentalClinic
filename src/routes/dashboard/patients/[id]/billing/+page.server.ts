import { superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';

import { requirePermission } from '$lib/server/permissions';
import { patientBalance, patientInvoices, unbilledWork } from '$lib/server/billing';
import { paymentMethodOptions } from '$lib/server/payments';
import { createInvoice } from '$lib/server/invoiceWrites';
import { openSessionFor } from '$lib/server/cashDrawer';
import { db } from '$lib/server/db';
import { clinicDate } from '$lib/clinicTime';
import { formatEthiopianDate } from '$lib/global.svelte';
import { messagesFor } from '$lib/i18n/messages';
import { canPay } from '$lib/invoiceStatus';
import { BILLING_PERMISSION, billingAction, payAction } from './billingAction';
import { payment } from '$lib/forms/payment';
import { newInvoice } from './schema';
import type { Actions, PageServerLoad } from './$types';

/**
 * The billing tab: what the patient owes, the work not yet billed, their bills, and taking a
 * payment across them.
 *
 * Money is not the chart's to show everyone, so unlike the other tabs this one needs
 * `billing.invoice` to open at all, not just the chart's `patients.view` — the layout hides the
 * tab from anyone without it, and this refuses them anyway.
 */
export const load: PageServerLoad = async (event) => {
	requirePermission(event.locals, BILLING_PERMISSION);
	const { patient } = await event.parent();
	const say = messagesFor(event.locals.lang).billing.tab;

	const [balance, bills, unbilled, methods, drawer, invoiceForm, payForm] = await Promise.all([
		patientBalance(patient.id),
		patientInvoices(patient.id),
		unbilledWork(patient.id),
		paymentMethodOptions(),
		openSessionFor(db, event.locals.branch.active),
		superValidate(zod4(newInvoice)),
		superValidate(zod4(payment))
	]);

	return {
		balance,
		bills,
		// What a new bill can be raised from, each with the visit it was done at.
		unbilled: unbilled.map((w) => ({
			id: w.id,
			service: w.service,
			where: w.where,
			price: w.fee,
			detail: w.visitAt
				? say.visitOf(formatEthiopianDate(new Date(clinicDate(w.visitAt))))
				: w.completedOn
					? say.doneOn(formatEthiopianDate(new Date(w.completedOn)))
					: undefined
		})),
		// The bills a payment can go to right now, with what each still owes.
		payable: bills
			.filter((b) => canPay(b.status, b.approvalStatus) && b.owed > 0)
			.map((b) => ({ id: b.id, number: b.invoiceNumber, owed: b.owed, issuedOn: b.issuedOn })),
		methods,
		drawerOpen: drawer !== null,
		forms: { invoice: invoiceForm, payment: payForm }
	};
};

export const actions: Actions = {
	newInvoice: (event) =>
		billingAction(event, newInvoice, async (tx, { patientId, data }) => {
			const id = await createInvoice(tx, event, {
				patientId,
				procedureIds: data.procedureIds,
				branchId: event.locals.branch.active
			});
			return {
				redirect: `/dashboard/patients/${patientId}/billing/${id}`,
				text: messagesFor(event.locals.lang).billing.tab.draftStarted
			};
		}),
	pay: payAction
};
