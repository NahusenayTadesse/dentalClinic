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
import { messagesFor } from '$lib/i18n/messages';
import type { Lang } from '$lib/i18n/lang';
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
import { applyCredit, patientCredit } from '$lib/server/deposits';
import { formatETB } from '$lib/global.svelte';
import { coverLinks } from '$lib/server/payerCover';
import type { Actions, PageServerLoad } from './$types';

/** The bill id from the path, or a 404 — never a query for `NaN`. */
function invoiceIdParam(raw: string, lang: Lang): number {
	const id = Number(raw);
	if (!Number.isInteger(id) || id <= 0) error(404, messagesFor(lang).billing.bill.notFound);
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
	const invoiceId = invoiceIdParam(event.params.invoiceId, event.locals.lang);

	const bill = await invoiceDetail(patient.id, invoiceId);
	if (!bill) error(404, messagesFor(event.locals.lang).billing.bill.notThisPatient);
	await logPatientView(patient.id, 'invoice', event, { recordId: invoiceId });

	const draft = bill.status === 'draft';
	const cover = await coverLinks(bill);
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

	// Credit can pay the patient's own payable bill; a payer's bill is the payer's to pay.
	const credit =
		canPay(bill.status, bill.approvalStatus) && bill.customerId === null && bill.owed > 0
			? await patientCredit(patient.id)
			: 0;

	return {
		bill,
		credit,
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
		vatRegistered: settings.vatRegistered,
		cover,
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

const billId = (event: { params: { invoiceId: string }; locals: { lang: Lang } }) =>
	invoiceIdParam(event.params.invoiceId, event.locals.lang);

/** The bill page's replies, in the language of the request. */
const words = (event: { locals: { lang: Lang } }) => messagesFor(event.locals.lang).billing.bill;

export const actions: Actions = {
	addWork: (event) =>
		billingAction(event, addWork, async (tx, { patientId, data }) => {
			await addWorkToInvoice(tx, event, patientId, billId(event), data.procedureIds);
			return words(event).added;
		}),

	addCharge: (event) =>
		billingAction(event, addChargeForm, async (tx, { patientId, data }) => {
			await addCharge(tx, event, patientId, billId(event), data);
			return words(event).chargeAdded;
		}),

	editLine: (event) =>
		billingAction(event, editLine, async (tx, { patientId, data }) => {
			await updateInvoiceLine(tx, event, patientId, billId(event), data);
			return words(event).lineUpdated;
		}),

	removeLine: (event) =>
		billingAction(event, removeLine, async (tx, { patientId, data }) => {
			await removeInvoiceLine(tx, event, patientId, billId(event), data.lineId);
			return words(event).lineRemoved;
		}),

	payer: (event) =>
		billingAction(event, payer, async (tx, { patientId, data }) => {
			const customerId = data.customerId ? Number(data.customerId) : null;
			await setPayer(tx, event, patientId, billId(event), customerId);
			return customerId ? words(event).toPayer : words(event).toPatient;
		}),

	discount: (event) =>
		billingAction(event, discount, async (tx, { patientId, data }) => {
			await setDiscount(tx, event, patientId, billId(event), data.discount);
			return data.discount > 0 ? words(event).discountSet : words(event).discountRemoved;
		}),

	issue: (event) =>
		billingAction(event, issue, async (tx, { patientId, data }) => {
			const { needsManager } = await issueInvoice(tx, event, patientId, billId(event), {
				dueOn: data.dueOn || null
			});
			return needsManager ? words(event).issuedNeedsManager : words(event).issuedDone;
		}),

	requestVoid: (event) =>
		billingAction(event, voidRequest, async (tx, { patientId, data }) => {
			await requestVoid(tx, event, patientId, billId(event), data.reason);
			return words(event).voidRequested;
		}),

	discard: (event) =>
		billingAction(event, confirmOnly, async (tx, { patientId }) => {
			await discardInvoice(tx, event, patientId, billId(event));
			return {
				redirect: `/dashboard/patients/${patientId}/billing`,
				text: words(event).discarded
			};
		}),

	pay: payAction,
	useCredit: (event) =>
		billingAction(event, confirmOnly, async (tx, { patientId }) => {
			const applied = await applyCredit(tx, event, patientId, billId(event));
			return messagesFor(event.locals.lang).billing.tab.creditApplied(formatETB(applied));
		}),

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
			return words(event).refundRequested;
		})
};
