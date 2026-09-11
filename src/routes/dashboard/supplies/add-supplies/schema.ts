import { z } from 'zod/v4';

export const supplyItemSchema = z.object({
	name: z.string().min(1, { message: 'Product Name is required.' }),

	description: z
		.string()
		.max(500, { message: "Product description can't be more than 500 characters." })
		.optional(),
	supplyType: z.coerce.string().min(1, { message: 'Supply Type is required.' }),
	// Whether the item is chased for return once issued out. Consumables are
	// written off on issue; returnable items are chased for return.
	returnable: z.boolean().default(false),
	unitOfMeasurement: z.coerce.string(),
	otherUnitOfMeasurement: z.coerce.string().optional(),
	reorderLevel: z.coerce
		.number()
		.int({ message: 'Reorder Level can only be full numbers, no decimals.' })
		.positive({ message: 'Reorder Level must be a positive number.' })
});

export type SupplyItemSchema = typeof supplyItemSchema;
