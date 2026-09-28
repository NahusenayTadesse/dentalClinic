import { z } from 'zod/v4';

/** Opening the drawer: what is in it before the day's trading. */
export const openDrawerForm = z.object({
	openingFloat: z.coerce.number().min(0, 'A float cannot be negative.').max(10_000_000)
});

/**
 * Counting and closing it: what was counted, what was taken out to bank, and — the server insists
 * when the count is off — why.
 */
export const closeDrawerForm = z.object({
	countedAmount: z.coerce.number().min(0, 'A count cannot be negative.').max(10_000_000),
	bankedAmount: z.coerce.number().min(0, 'Banked cannot be negative.').max(10_000_000),
	note: z.string().max(1000).optional()
});
