import { error } from '@sveltejs/kit';
import { superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';

import { requirePermission } from '$lib/server/permissions';
import { logPatientView } from '$lib/server/patients';
import { invoiceDetail, unbilledWork } from '$lib/server/billing';
import {
	addCharge,
	addWorkToInvoice,
	discardInvoice,
	issueInvoice,
	removeInvoiceLine,
	requestVoid,
	setDiscount,
	setPayer,
	updateInvoiceLine
} from '$lib/server/invoiceWrites';
import { paymentMethodOptions, requestRefund } from '$lib/server/payments';
import { openSessionFor } from '$lib/server/cashDrawer';
import { readSettings } from '$lib/server/settings';
import { db } from '$lib/server/db';
import { payment } from '$lib/forms/payment';
import { customerList } from '$lib/server/fastData';
import { canPay } from '$lib/invoiceStatus';
import { BILLING_PERMISSION, billingAction, payAction } from '../billingAction';
import {
	addCharge as addChargeForm,
	addWork,
	confirmOnly,
	discount,
	editLine,
	issue,
	payer,
	refund,
	removeLine,
	voidRequest
} from '../schema';
import type { Actions, PageServerLoad } from './$types';

/** The bill id from the path, or a 404 — never a query for `NaN`. */
function invoiceIdParam(raw: string): number {
	const id = Number(raw);
	if (!Number.isInteger(id) || id <= 0) error(404, 'Bill not found');
	return id;
}

/**
 * One bill: a draft being put together, or an issued bill taking payments. Every step is an action
 * that re-checks the bill is this patient's and allows the step (`server/invoiceWrites.ts`); the
 * page offers only the steps `$lib/invoiceStatus.ts` says the bill is at.
 */
export const load: PageServerLoad = async (event) => {
	requirePermission(event.locals, BILLING_PERMISSION);
	const { patient } = await event.parent();
	const invoiceId = invoiceIdParam(event.params.invoiceId);

	const bill = await invoiceDetail(patient.id, invoiceId);
	if (!bill) error(404, 'That bill is not on this patient’s record.');
	await logPatientView(patient.id, 'invoice', event, { recordId: invoiceId });

	const draft = bill.status === 'draft';
	const [unbilled, methods, drawer, settings, payers, forms] = await Promise.all([
		draft ? unbilledWork(patient.id) : Promise.resolve([]),
		paymentMethodOptions(),
		openSessionFor(db, event.locals.branch.active),
		readSettings(),
		customerList(),
		Promise.all([
			superValidate(zod4(addWork)),
			superValidate(zod4(addChargeForm)),
			superValidate(zod4(editLine)),
			superValidate(zod4(removeLine)),
			superValidate({ discount: bill.discount ?? 0 }, zod4(discount)),
			superValidate(zod4(issue)),
			superValidate(zod4(voidRequest)),
			superValidate(zod4(payment)),
			superValidate(zod4(confirmOnly)),
			superValidate(zod4(refund)),
			superValidate({ customerId: bill.customerId ? String(bill.customerId) : '' }, zod4(payer))
		])
	]);
	const [
		add,
		charge,
		edit,
		remove,
		discountForm,
		issueForm,
		voidForm,
		payForm,
		confirm,
		refundForm,
		payerForm
	] = forms;

	return {
		bill,
		unbilled: unbilled.map((w) => ({ id: w.id, service: w.service, where: w.where, price: w.fee })),
		payable: canPay(bill.status, bill.approvalStatus)
			? [{ id: bill.id, number: bill.invoiceNumber, owed: bill.owed, issuedOn: bill.issuedOn }]
			: [],
		methods,
		payers,
		// Named from the list when the payer is live; a payer deleted since still owns the bill.
		payerName: payers.find((p) => p.value === bill.customerId)?.name ?? null,
		drawerOpen: drawer !== null,
		discountThreshold: settings.discountApprovalPercent,
		forms: {
			add,
			charge,
			edit,
			remove,
			discount: discountForm,
			issue: issueForm,
			void: voidForm,
			payment: payForm,
			confirm,
			refund: refundForm,
			payer: payerForm
		}
	};
};

const billId = (event: { params: { invoiceId: string } }) => invoiceIdParam(event.params.invoiceId);

export const actions: Actions = {
	addWork: (event) =>
		billingAction(event, addWork, async (tx, { patientId, data }) => {
			await addWorkToInvoice(tx, event, patientId, billId(event), data.procedureIds);
			return 'Added to the bill.';
		}),

	addCharge: (event) =>
		billingAction(event, addChargeForm, async (tx, { patientId, data }) => {
			await addCharge(tx, event, patientId, billId(event), data);
			return 'Charge added.';
		}),

	editLine: (event) =>
		billingAction(event, editLine, async (tx, { patientId, data }) => {
			await updateInvoiceLine(tx, event, patientId, billId(event), data);
			return 'Line updated.';
		}),

	removeLine: (event) =>
		billingAction(event, removeLine, async (tx, { patientId, data }) => {
			await removeInvoiceLine(tx, event, patientId, billId(event), data.lineId);
			return 'Line removed.';
		}),

	payer: (event) =>
		billingAction(event, payer, async (tx, { patientId, data }) => {
			const customerId = data.customerId ? Number(data.customerId) : null;
			await setPayer(tx, event, patientId, billId(event), customerId);
			return customerId ? 'The bill goes to the payer.' : 'The patient pays this bill.';
		}),

	discount: (event) =>
		billingAction(event, discount, async (tx, { patientId, data }) => {
			await setDiscount(tx, event, patientId, billId(event), data.discount);
			return data.discount > 0 ? 'Discount set.' : 'Discount removed.';
		}),

	issue: (event) =>
		billingAction(event, issue, async (tx, { patientId, data }) => {
			const { needsManager } = await issueInvoice(tx, event, patientId, billId(event), {
				dueOn: data.dueOn || null
			});
			return needsManager
				? 'Issued. Its discount is over the limit, so a manager must approve it before it can be paid.'
				: 'Issued.';
		}),

	requestVoid: (event) =>
		billingAction(event, voidRequest, async (tx, { patientId, data }) => {
			await requestVoid(tx, event, patientId, billId(event), data.reason);
			return 'Void requested. A manager approves it in Approvals → Discounts and Voids.';
		}),

	discard: (event) =>
		billingAction(event, confirmOnly, async (tx, { patientId }) => {
			await discardInvoice(tx, event, patientId, billId(event));
			return {
				redirect: `/dashboard/patients/${patientId}/billing`,
				text: 'Draft thrown away. Its work is unbilled again.'
			};
		}),

	pay: payAction,

	requestRefund: (event) =>
		billingAction(event, refund, async (tx, { patientId, data }) => {
			await requestRefund(tx, event, {
				patientId,
				invoiceId: billId(event),
				paymentId: data.paymentId,
				amount: data.amount,
				paymentMethodId: Number(data.paymentMethodId),
				reason: data.reason,
				branchId: event.locals.branch.active
			});
			return 'Refund requested. A manager approves it in Approvals → Refunds before the money goes back.';
		})
};
