import { z } from 'zod';

// "መስከረም_2017" style values coming from MonthYearMul
const monthYear = z.string().regex(/^.+_\d{4}$/, 'Invalid month value');

export const add = z.object({
	requestDate: z.string().min(1, 'Request date is required'),
	requestor: z.coerce.number().int().positive('Requestor is required'),

	// everything the user selected in MonthYearMul
	months: z.array(monthYear).min(1, 'Select at least one month'),

	vat: z.coerce.number().min(0),
	withhold: z.coerce.number().min(0),

	// one entry per site invoice; `months` inside each item is the subset of
	// selected months that this site has NOT been requested for yet
	items: z
		.array(
			z.object({
				siteId: z.number().int().positive(),
				invoiceNumber: z.string().min(1),
				months: z.array(monthYear).min(1),
				penality: z.coerce.number().min(0).default(0)
			})
		)
		.min(1, 'No sites left to request for the selected month(s)')
});

export type AddSchema = typeof add;