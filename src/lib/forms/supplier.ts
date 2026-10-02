import { z } from 'zod/v4';

/**
 * A supplier and its address — one schema for the add page and the detail page's edit dialog.
 *
 * There used to be three, and they disagreed: the list page's copy validated a `location` the
 * table does not have, the add action dropped the email it had just checked, and the detail page
 * took the address row's id from the form — so a hand-edited post could rewrite somebody else's
 * address. The address id now comes from the supplier row on the server.
 */
export const supplier = z.object({
	name: z.string('Name is required').trim().min(1, 'Name is required').max(50),
	phone: z.string('Phone is required').trim().min(10, 'Phone is required').max(15),
	// Optional, so '' must stay '' (CLAUDE.md §13) — checked as an address only when given.
	email: z
		.string()
		.trim()
		.max(100)
		.refine((v) => v === '' || z.email().safeParse(v).success, 'Enter a valid email address')
		.default(''),
	description: z.string().max(255).default(''),
	subcity: z.coerce.number('Subcity is required').int().positive('Subcity is required'),
	street: z.string().max(100).default(''),
	kebele: z.string().max(100).default(''),
	buildingNumber: z.string().max(10).default(''),
	floor: z.coerce.number().int().min(0).default(0),
	houseNumber: z.coerce.number().int().min(0).default(0),
	status: z.boolean('Status is required').default(true)
});

export type Supplier = z.infer<typeof supplier>;
