import type { RequestEvent } from '@sveltejs/kit';
import type { z } from 'zod/v4';
import type { Infer } from 'sveltekit-superforms';

import { db } from '$lib/server/db';
import { patientAction } from '$lib/server/patientAction';
import { takePayment } from '$lib/server/payments';
import { formatETB } from '$lib/global.svelte';
import { payment } from '$lib/forms/payment';

/** Who may raise a bill and take payment. Reading the tab needs it too — see the tab's load. */
export const BILLING_PERMISSION = 'billing.invoice';

/** A transaction on the database, as `db.transaction` hands it over. */
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** A billing action: `patientAction` under the billing permission. */
export function billingAction<S extends z.ZodObject>(
	event: RequestEvent,
	schema: S,
	write: (
		tx: Tx,
		input: { patientId: number; data: Infer<S, 'zod4'> }
	) => Promise<string | { redirect: string; text: string }>
) {
	return patientAction(event, BILLING_PERMISSION, schema, write);
}

/**
 * Taking a payment, posted from the billing tab (several bills) and from a bill's own page (that
 * one). One action for both, so the two forms cannot come to disagree about what a payment is.
 */
export function payAction(event: RequestEvent) {
	return billingAction(event, payment, async (tx, { patientId, data }) => {
		await takePayment(tx, event, {
			patientId,
			allocations: data.allocations,
			paymentMethodId: Number(data.paymentMethodId),
			branchId: event.locals.branch.active,
			reference: data.reference ?? null
		});
		const total = data.allocations.reduce((sum, a) => sum + a.amount, 0);
		return `Payment of ${formatETB(total)} recorded.`;
	});
}
