import { superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';

import { requirePermission } from '$lib/server/permissions';
import { patientBalance, patientInvoices, unbilledWork } from '$lib/server/billing';
import { paymentMethodOptions } from '$lib/server/payments';
import { createInvoice } from '$lib/server/invoiceWrites';
import { openSessionFor } from '$lib/server/cashDrawer';
import { db } from '$lib/server/db';
import { clinicDate } from '$lib/clinicTime';
import { formatETB, formatEthiopianDate } from '$lib/global.svelte';
import { messagesFor } from '$lib/i18n/messages';
import { canPay } from '$lib/invoiceStatus';
import { BILLING_PERMISSION, billingAction, payAction } from './billingAction';
import { onlineActions, onlinePaymentData } from './onlineActions';
import { payment } from '$lib/forms/payment';
import { deposit, newInvoice, sellPackageForm } from './schema';
import { offeredPackages, patientPackages, sellPackage } from '$lib/server/packages';
import { patientCredit, takeDeposit } from '$lib/server/deposits';
import { AUTHORISATIONS } from './authorisations.server';
import { childActions } from '$lib/server/childCrud';
import { livePatientId } from '$lib/server/patients';
import { customerList } from '$lib/server/fastData';
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

	const [
		balance,
		credit,
		bills,
		unbilled,
		methods,
		drawer,
		invoiceForm,
		payForm,
		depositForm,
		authorisations,
		payers,
		prepaid,
		packages,
		sellForm,
		online
	] = await Promise.all([
		patientBalance(patient.id),
		patientCredit(patient.id),
		patientInvoices(patient.id),
		unbilledWork(patient.id),
		paymentMethodOptions(),
		openSessionFor(db, event.locals.branch.active),
		superValidate(zod4(newInvoice)),
		superValidate(zod4(payment)),
		superValidate(zod4(deposit)),
		AUTHORISATIONS.Authorisation.load(patient.id),
		customerList(),
		offeredPackages('prepaid'),
		patientPackages(patient.id),
		superValidate(zod4(sellPackageForm)),
		onlinePaymentData(patient.id)
	]);

	return {
		balance,
		credit,
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
		forms: { invoice: invoiceForm, payment: payForm, deposit: depositForm, sell: sellForm },
		// Prepaid packages that can be sold, and the ones this patient has, with what is left.
		prepaid: prepaid.map((p) => ({ id: p.id, name: p.name, price: p.price })),
		packages,
		authorisations,
		payers,
		online
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
	pay: payAction,
	...onlineActions,
	sellPackage: (event) =>
		billingAction(event, sellPackageForm, async (tx, { patientId, data }) => {
			const sold = await sellPackage(tx, event, {
				patientId,
				packageId: Number(data.packageId),
				branchId: event.locals.branch.active
			});
			return {
				redirect: `/dashboard/patients/${patientId}/billing/${sold.invoiceId}`,
				text: messagesFor(event.locals.lang).billing.tab.packageSold(sold.name)
			};
		}),
	deposit: (event) =>
		billingAction(event, deposit, async (tx, { patientId, data }) => {
			await takeDeposit(tx, event, {
				patientId,
				amount: data.amount,
				paymentMethodId: Number(data.paymentMethodId),
				branchId: event.locals.branch.active,
				reference: data.reference || null,
				note: data.note || null
			});
			return messagesFor(event.locals.lang).billing.tab.depositTaken(formatETB(data.amount));
		}),
	// Add, edit and delete a pre-authorisation, each checked to be this patient's.
	...childActions(AUTHORISATIONS, livePatientId)
};
