import { z } from 'zod/v4';

/** The kinds a payment method can be — see `paymentMethods.kind`. Cash needs the drawer open. */
export const PAYMENT_KINDS = [
	{ value: 'cash', name: 'Cash — goes in the drawer' },
	{ value: 'bank', name: 'Bank transfer or cheque' },
	{ value: 'mobile', name: 'Mobile money (Telebirr, M-Pesa…)' },
	{ value: 'card', name: 'Card' },
	{ value: 'other', name: 'Other' }
] as const;

const kind = z.enum(['cash', 'bank', 'mobile', 'card', 'other'], 'Choose what kind of money it is');

/** A new payment method. */
export const paymentMethod = z.object({
	name: z.string('Name of Payment Method is required').trim().min(2).max(50),
	kind
});

/** Changing one. */
export const editPaymentMethod = z.object({
	id: z.coerce.number().int().positive(),
	name: z.string('Name of Payment Method is required').trim().min(2).max(50),
	kind
});

export type EditPaymentMethod = z.infer<typeof editPaymentMethod>;
