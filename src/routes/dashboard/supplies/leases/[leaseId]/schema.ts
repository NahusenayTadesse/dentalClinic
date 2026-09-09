import { z } from 'zod/v4';

/**
 * Every action on a lease posts its own form. All of them carry per-item lines,
 * so all of them post JSON (`dataType: 'json'`).
 *
 * Quantities are validated for shape only here — whether a number is actually
 * available, approved, or still outstanding depends on rows that can change
 * between render and submit, so those checks live in the action, under the
 * transaction that writes them.
 */

const quantity = z.coerce
	.number({ message: 'Quantity must be a number.' })
	.int({ message: 'Quantity must be a whole number.' })
	.min(0, { message: 'Quantity cannot be negative.' });

const itemId = z.coerce.number().int().positive();

export const approveSchema = z.object({
	items: z
		.array(z.object({ itemId, quantity }))
		.min(1, { message: 'Nothing to approve.' })
		.refine((items) => items.some((item) => item.quantity > 0), {
			message: 'Approve at least one item, or reject the request instead.'
		}),
	note: z.string().max(255, { message: 'Note is too long.' }).optional()
});

export const rejectSchema = z.object({
	reason: z
		.string()
		.min(1, { message: 'Say why this is being rejected.' })
		.max(255, { message: 'Reason is too long.' })
});

export const cancelSchema = z.object({
	reason: z
		.string()
		.min(1, { message: 'Say why this is being cancelled.' })
		.max(255, { message: 'Reason is too long.' })
});

export const issueSchema = z.object({
	items: z
		.array(z.object({ itemId, quantity }))
		.min(1, { message: 'Nothing to issue.' })
		.refine((items) => items.some((item) => item.quantity > 0), {
			message: 'Enter a quantity for at least one item.'
		}),
	receivedByName: z
		.string()
		.min(1, { message: 'Record who signed for the goods at the site.' })
		.max(100, { message: 'Name is too long.' }),
	receivedByPhone: z.string().max(20, { message: 'Phone number is too long.' }).optional(),
	note: z.string().max(255, { message: 'Note is too long.' }).optional()
});

export const returnSchema = z.object({
	items: z
		.array(
			z.object({
				itemId,
				quantity,
				// `good` goes back on the shelf; the other two are written off,
				// because those units are never re-entering the store.
				condition: z.enum(['good', 'damaged', 'lost']).default('good')
			})
		)
		.min(1, { message: 'Nothing to return.' })
		.refine((items) => items.some((item) => item.quantity > 0), {
			message: 'Enter a quantity for at least one item.'
		}),
	reason: z.string().max(255, { message: 'Note is too long.' }).optional()
});

export const closeSchema = z.object({
	note: z.string().max(255, { message: 'Note is too long.' }).optional()
});
