import { z } from 'zod/v4';

/**
 * A lease is a header plus one or more item lines, so the form posts as JSON
 * (`dataType: 'json'` on the client) rather than flat fields — the same shape
 * the roles and payment forms use for their nested data.
 */
export const leaseItemLineSchema = z.object({
	supplyId: z.coerce
		.number({ message: 'Choose a supply item.' })
		.int()
		.positive({ message: 'Choose a supply item.' }),
	quantity: z.coerce
		.number({ message: 'Quantity must be a number.' })
		.int({ message: 'Quantity must be a whole number.' })
		.positive({ message: 'Quantity must be more than zero.' }),
	notes: z.string().max(255, { message: 'Note is too long.' }).optional()
});

export const leaseRequestSchema = z.object({
	siteId: z.coerce
		.number({ message: 'Choose the site this is for.' })
		.int()
		.positive({ message: 'Choose the site this is for.' }),
	reason: z
		.string()
		.min(1, { message: 'Say why the site needs these supplies.' })
		.max(255, { message: 'Reason is too long.' }),
	referenceNumber: z.string().max(50, { message: 'Reference is too long.' }).optional(),
	// Only meaningful when the request includes a returnable item; the server
	// leaves it null otherwise rather than inventing a due date for consumables.
	expectedReturnDate: z.string().optional(),
	items: z
		.array(leaseItemLineSchema)
		.min(1, { message: 'Add at least one supply item.' })
		// Two lines for the same supply would trip `unique_supply_per_lease` at
		// the database, which is a worse error than saying so here.
		.refine((items) => new Set(items.map((item) => item.supplyId)).size === items.length, {
			message: 'Each supply item can only appear once — change the quantity instead.'
		})
});

export type LeaseRequestSchema = typeof leaseRequestSchema;
