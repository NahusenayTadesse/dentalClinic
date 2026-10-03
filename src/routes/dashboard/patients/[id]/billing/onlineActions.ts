import type { RequestEvent } from '@sveltejs/kit';
import { message, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';

import { formAction } from '$lib/server/patientAction';
import { requirePermission } from '$lib/server/permissions';
import { livePatientId } from '$lib/server/patients';
import {
	applyAnswer,
	askGateway,
	cancelOnlinePayment,
	enabledGateways,
	patientOnlinePayments,
	prepareOnlinePayment,
	textPaymentLink
} from '$lib/server/onlinePayments';
import { smsReady } from '$lib/server/sms';
import { formatETB } from '$lib/global.svelte';
import { messagesFor } from '$lib/i18n/messages';
import { onlinePayment, onlinePaymentId } from '$lib/forms/payment';
import { BILLING_PERMISSION } from './billingAction';

/**
 * Online payments on a patient's billing tab and on a bill's own page: what the list needs, and
 * the four things the desk does — start one, check one, text its link, stop waiting for it. One
 * module for both pages, so the two cannot come to disagree, the way `payAction` is one for paying.
 *
 * Each step asks the gateway first and writes after (`server/onlinePayments`): `formAction`'s
 * prepare step is where the network goes, and its transaction is only the write.
 */

/** What `OnlinePayments.svelte` needs for one patient. */
export async function onlinePaymentData(patientId: number) {
	const [gateways, payments, texting, start, step] = await Promise.all([
		enabledGateways(),
		patientOnlinePayments(patientId),
		smsReady(),
		superValidate(zod4(onlinePayment), { id: 'online-start' }),
		superValidate(zod4(onlinePaymentId), { id: 'online-step' })
	]);
	return { gateways, payments, smsReady: texting, forms: { start, step } };
}

export const onlineActions = {
	payOnline: (event: RequestEvent) =>
		formAction(event, BILLING_PERMISSION, onlinePayment, async (data) => {
			const patientId = await livePatientId(event);
			const write = await prepareOnlinePayment(event, {
				patientId,
				gatewayId: Number(data.gatewayId),
				allocations: data.allocations,
				phone: data.phone || null,
				origin: event.url.origin,
				branchId: event.locals.branch.active
			});
			return async (tx) => {
				await write(tx);
				const total = data.allocations.reduce((sum, a) => sum + a.amount, 0);
				return messagesFor(event.locals.lang).billing.online.created(formatETB(total));
			};
		}),

	checkOnline: (event: RequestEvent) =>
		formAction(event, BILLING_PERMISSION, onlinePaymentId, async (data) => {
			const patientId = await livePatientId(event);
			const answer = await askGateway(data.id);
			const w = messagesFor(event.locals.lang).billing.online;
			return async (tx) => {
				if (!answer) return w.pendingText;
				const applied = await applyAnswer(tx, event, answer, patientId);
				return {
					paid: w.paidText,
					pending: w.pendingText,
					cancelled: w.cancelledText,
					failed: applied.text
				}[applied.status];
			};
		}),

	stopOnline: (event: RequestEvent) =>
		formAction(event, BILLING_PERMISSION, onlinePaymentId, async (data) => {
			const patientId = await livePatientId(event);
			return async (tx) => {
				await cancelOnlinePayment(tx, event, patientId, data.id);
				return messagesFor(event.locals.lang).billing.online.stopped;
			};
		}),

	/** Not a write of ours — the SMS module logs the message — so not in a transaction. */
	textOnline: async (event: RequestEvent) => {
		requirePermission(event.locals, BILLING_PERMISSION);
		// No form id of our own: the reply goes back to whichever row's button posted.
		const form = await superValidate(event.request, zod4(onlinePaymentId));
		if (!form.valid)
			return message(form, { type: 'error', text: 'Check the form.' }, { status: 400 });
		const patientId = await livePatientId(event);
		const w = messagesFor(event.locals.lang).billing.online;
		const outcome = await textPaymentLink(event, patientId, form.data.id);
		if (outcome.status === 'sent') return message(form, { type: 'success', text: w.texted });
		const text = 'why' in outcome ? w.notTexted[outcome.why] : outcome.reason;
		return message(form, { type: 'error', text }, { status: 400 });
	}
};
