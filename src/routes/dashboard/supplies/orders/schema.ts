import { z } from 'zod/v4';

/*
 * The purchasing forms. Optional choices stay strings and the server reads `''` as none
 * (CLAUDE.md §13). The rules are `$lib/purchasing.ts`'s, applied again on the server.
 */

/** Starting an order: to whom. */
export const newOrder = z.object({ supplierId: z.string().min(1, 'Choose the supplier') });

/** A draft's lines, posted as JSON (`dataType: 'json'`): a list is not a set of fields. */
export const draftLines = z.object({
	lines: z
		.array(
			z.object({
				supplyId: z.number().int().positive(),
				quantity: z.number().positive('A quantity'),
				unitCost: z.number().min(0).nullable()
			})
		)
		.max(200),
	expectedOn: z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/, 'Choose a date'),
	note: z.string().trim().max(1000)
});

/** A delivery against one line. */
export const receiveLine = z.object({
	lineId: z.coerce.number().int().positive(),
	quantity: z.coerce.number().positive('How many arrived'),
	batchNumber: z.string().trim().max(60).optional(),
	expiryDate: z
		.string()
		.regex(/^(\d{4}-\d{2}-\d{2})?$/, 'Choose a date')
		.optional()
});

/** A supplier's invoice, paid now if a method is chosen. */
export const newSupplierInvoice = z.object({
	invoiceNo: z.string().trim().min(1, 'The supplier’s invoice number').max(60),
	invoiceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'The date on the invoice'),
	amount: z.coerce.number().positive('The amount on the invoice'),
	paymentMethodId: z.string(),
	note: z.string().trim().max(255).optional()
});

/** Paying an invoice recorded earlier. */
export const payInvoice = z.object({
	invoiceId: z.coerce.number().int().positive(),
	paymentMethodId: z.string().min(1, 'Choose how it was paid')
});

/** A step with nothing to fill in: sending or cancelling. */
export const orderStep = z.object({});

export type DraftLines = z.infer<typeof draftLines>;
