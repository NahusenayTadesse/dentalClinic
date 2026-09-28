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
