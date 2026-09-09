import { z } from 'zod/v4';

/**
 * Setting a balance by hand writes it straight over the running total, bypassing
 * the ledger in `bankInsertHistory`. That is how an opening balance gets set, and
 * it is also the one way the balance can stop agreeing with the movements behind
 * it — so the user has to say they meant it.
 */
const acknowledgeManualChange = z.coerce
	.boolean()
	.refine((value) => value === true, 'Confirm you understand this overwrites the balance');

export const paymentMethod = z.object({
	bank: z.number('Name of Bank is required').positive('Name of Bank is required'),
	account: z.string('Account Number is Required'),
	amount: z.number('Amount is required').nonnegative('Amount cannot be negative'),
	acknowledgeManualChange
});

export const editPaymentMethod = z.object({
	id: z.coerce.string(),
	bank: z.number('Name of Bank is required').positive('Name of Bank is required'),
	account: z.string('Account Number is Required'),
	// Negative is allowed on edit: these balances are a bookkeeping aid, and
	// refusing would block someone recording an account that really is overdrawn.
	amount: z.number('Amount is required'),
	acknowledgeManualChange
});
export type EditPaymentMethod = z.infer<typeof editPaymentMethod>;
