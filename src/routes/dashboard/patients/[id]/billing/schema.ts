import { z } from 'zod/v4';

/*
 * The billing forms. Each is only what the person chooses — which work, what wording, how much
 * they are paying and how. Totals, numbers, statuses and whether a manager is needed are worked out
 * by the server (`server/invoiceWrites.ts`, `server/payments.ts`), never posted.
 *
 * Optional choices stay strings and the server reads `''` as none (CLAUDE.md §13).
 */

const work = z
	.array(z.coerce.number().int().positive())
	.min(1, 'Choose at least one piece of work.');

/** A new bill, from completed work. */
export const newInvoice = z.object({ procedureIds: work });

/** More completed work onto a draft. */
export const addWork = z.object({ procedureIds: work });

/** A charge that is not charted work — a missed-appointment fee, something sold. */
export const addCharge = z.object({
	description: z.string().trim().min(1, 'Say what the charge is for.').max(255),
	quantity: z.coerce.number().positive('At least one.').max(1000),
	unitPrice: z.coerce.number().min(0, 'A price cannot be negative.').max(10_000_000),
	/** Goods sold carry VAT when the clinic is registered; treatment does not (`$lib/billTax.ts`). */
	taxable: z.boolean().default(false)
});

/** A draft line's wording, quantity and price. */
export const editLine = z.object({
	lineId: z.coerce.number().int().positive(),
	description: z.string().trim().min(1, 'Say what this line is.').max(255),
	quantity: z.coerce.number().positive('At least one.').max(1000),
	unitPrice: z.coerce.number().min(0, 'A price cannot be negative.').max(10_000_000)
});

/** One line, for taking it off a draft. */
export const removeLine = z.object({ lineId: z.coerce.number().int().positive() });

/** The discount on a draft, in birr. 0 takes it off. */
export const discount = z.object({
	discount: z.coerce.number().min(0, 'A discount cannot be negative.').max(10_000_000)
});

/** Issuing a draft: when payment is due, if not now. */
export const issue = z.object({
	dueOn: z
		.string()
		.regex(/^(\d{4}-\d{2}-\d{2})?$/, 'Choose a date')
		.optional()
});

/** Asking for an issued bill to be voided. */
export const voidRequest = z.object({
	reason: z.string().trim().min(1, 'Say why it is being voided.').max(255)
});

/** Who a draft is billed to: an employer or insurer's id, or `''` for the patient themself. */
export const payer = z.object({ customerId: z.string() });

/**
 * Asking to give money back from one payment. A manager approves it before it counts; how much
 * may be given back is checked by the server against what that payment put on this bill.
 */
export const refund = z.object({
	paymentId: z.coerce.number().int().positive(),
	amount: z.coerce.number().positive('Enter an amount to refund.').max(10_000_000),
	paymentMethodId: z.string().min(1, 'Choose how it is being given back.'),
	reason: z.string().trim().min(1, 'Say why the money is being given back.').max(200)
});

/** A step with nothing to fill in: issuing without a due date, discarding a draft. */
export const confirmOnly = z.object({});

export type AddWork = z.infer<typeof addWork>;
export type AddCharge = z.infer<typeof addCharge>;
export type EditLine = z.infer<typeof editLine>;
export type Refund = z.infer<typeof refund>;

/** A deposit: money taken before there is a bill (`server/deposits.ts`). */
export const deposit = z.object({
	amount: z.coerce.number().positive('Enter the amount.'),
	paymentMethodId: z.string().min(1, 'Choose how it was paid.'),
	reference: z.string().trim().max(128).optional(),
	note: z.string().trim().max(255).optional()
});

export type Deposit = z.infer<typeof deposit>;

/** Selling a prepaid package (`server/packages.ts`). */
export const sellPackageForm = z.object({
	packageId: z.string().min(1, 'Choose the package.')
});

export type SellPackage = z.infer<typeof sellPackageForm>;

/** Applying a bundle to a draft, or taking it off (`server/packages.ts`). */
export const bundleForm = z.object({ packageId: z.coerce.number().int().positive() });
