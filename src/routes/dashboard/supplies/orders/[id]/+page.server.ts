import { error } from '@sveltejs/kit';
import { superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';

import { formAction } from '$lib/server/patientAction';
import {
	PURCHASING_PERMISSION,
	cancelOrder,
	orderDetail,
	orderableItems,
	paySupplierInvoice,
	receivePurchase,
	recordSupplierInvoice,
	saveDraft,
	sendOrder
} from '$lib/server/purchasing';
import { paymentMethods } from '$lib/server/fastData';
import { clinicToday } from '$lib/clinicTime';
import { draftLines, newSupplierInvoice, orderStep, payInvoice, receiveLine } from '../schema';
import type { Actions, PageServerLoad } from './$types';

/** The order id from the path, or a 404 — never a query for `NaN`. */
function orderIdParam(raw: string): number {
	const id = Number(raw);
	if (!Number.isInteger(id) || id <= 0) error(404, 'Order not found');
	return id;
}

/**
 * One purchase order: a draft's lines to edit, a sent order's deliveries to receive, and the
 * supplier's invoices set against what was ordered and what arrived. Every step re-checks the
 * order is this branch's and allows it (`server/purchasing.ts`).
 */
export const load: PageServerLoad = async ({ params, locals }) => {
	const detail = await orderDetail(locals.branch, orderIdParam(params.id));
	if (!detail) error(404, 'That order is not in this branch’s list.');
	const draft = detail.order.status === 'draft';
	const [items, methods, lines, receive, invoice, pay, step] = await Promise.all([
		draft ? orderableItems(locals.branch) : Promise.resolve([]),
		paymentMethods(),
		superValidate(
			{
				lines: detail.lines.map((l) => ({
					supplyId: l.supplyId,
					quantity: l.quantity,
					unitCost: l.unitCost
				})),
				expectedOn: detail.order.expectedOn ?? '',
				note: detail.order.note ?? ''
			},
			zod4(draftLines),
			{ errors: false }
		),
		superValidate(zod4(receiveLine)),
		superValidate({ invoiceDate: clinicToday() }, zod4(newSupplierInvoice), { errors: false }),
		superValidate(zod4(payInvoice)),
		superValidate(zod4(orderStep))
	]);
	return {
		...detail,
		items,
		methods: methods.map((m) => ({ value: String(m.value), name: m.name })),
		forms: { lines, receive, invoice, pay, step }
	};
};

const id = (params: { id?: string }) => orderIdParam(params.id ?? '');

export const actions: Actions = {
	save: (event) =>
		formAction(event, PURCHASING_PERMISSION, draftLines, async (data) => async (tx) => {
			await saveDraft(tx, event, id(event.params), {
				lines: data.lines,
				expectedOn: data.expectedOn || null,
				note: data.note || null
			});
			return 'Draft saved.';
		}),

	send: (event) =>
		formAction(event, PURCHASING_PERMISSION, orderStep, async () => async (tx) => {
			const number = await sendOrder(tx, event, id(event.params));
			return `Sent as ${number}. Print it for the supplier.`;
		}),

	cancel: (event) =>
		formAction(event, PURCHASING_PERMISSION, orderStep, async () => async (tx) => {
			await cancelOrder(tx, event, id(event.params));
			return 'Order cancelled.';
		}),

	receive: (event) =>
		formAction(event, PURCHASING_PERMISSION, receiveLine, async (data) => async (tx) => {
			await receivePurchase(tx, event, id(event.params), {
				lineId: data.lineId,
				quantity: data.quantity,
				batchNumber: data.batchNumber || null,
				expiryDate: data.expiryDate || null
			});
			return 'Received into stock.';
		}),

	invoice: (event) =>
		formAction(event, PURCHASING_PERMISSION, newSupplierInvoice, async (data) => async (tx) => {
			await recordSupplierInvoice(tx, event, id(event.params), {
				invoiceNo: data.invoiceNo,
				invoiceDate: data.invoiceDate,
				amount: data.amount,
				note: data.note || null,
				paymentMethodId: Number(data.paymentMethodId) || null
			});
			return data.paymentMethodId
				? 'Invoice recorded and paid.'
				: 'Invoice recorded, to pay later.';
		}),

	pay: (event) =>
		formAction(event, PURCHASING_PERMISSION, payInvoice, async (data) => async (tx) => {
			await paySupplierInvoice(
				tx,
				event,
				id(event.params),
				data.invoiceId,
				Number(data.paymentMethodId)
			);
			return 'Invoice paid.';
		})
};
