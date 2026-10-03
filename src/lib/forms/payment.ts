import { z } from 'zod/v4';

/*
 * Taking a payment, from a patient against their bills or from an employer or insurer against the
 * bills billed to them. One schema for both, posted by `components/PaymentForm.svelte`; the server
 * re-checks every amount against what each bill still owes (`server/payments.ts`).
 */

/**
 * A payment: how much goes to each bill, and how it was paid. Posted as JSON — a list of amounts
 * against bills does not survive a trip through form fields.
 */
export const payment = z.object({
	allocations: z.array(
		z.object({
			invoiceId: z.number().int().positive(),
			amount: z.number().min(0, 'An amount cannot be negative.')
		})
	),
	paymentMethodId: z.string().min(1, 'Choose how it was paid.'),
	reference: z.string().max(128).optional()
});

export type Payment = z.infer<typeof payment>;

/**
 * A payment asked for through an online gateway: the same split across bills, the gateway account
 * the desk chose, and the phone the patient pays from. The gateway id stays a string, as a select
 * posts it — a client schema must parse a value to itself.
 */
export const onlinePayment = z.object({
	allocations: payment.shape.allocations,
	gatewayId: z.string().min(1, 'Choose the gateway.'),
	phone: z.string().trim().max(20).optional()
});

export type OnlinePayment = z.infer<typeof onlinePayment>;

/** One online payment on the list: checking it, texting its link, or giving up on it. */
export const onlinePaymentId = z.object({ id: z.coerce.number().int().positive() });
