import { formatEthiopianYear } from '$lib/global.svelte';
import { ACCEPTED_FILE_TYPES, MAX_FILE_SIZE } from '$lib/zodschemas/appointmentSchema';

import { z } from 'zod/v4';

export const penality = z.object({
	contract: z.number('Contract is required'),
	penalityAmount: z.number('Penality amount is required'),
	penalityReason: z.string('Penality reason is required'),
	penalityDate: z.string('Penality date is required'),
	month: z.string('Penality month is required'),
	penalityLetter: z.file().max(100000000).optional()
});

export type AddPen = z.infer<typeof penality>;

export const add = z.object({
	contracts: z.number('Contract is required').array(),
	invoiceNumbers: z.string('Invoice number is required').array(),
	// amount is summed from the site's contracts server-side, not posted by the client
	// penalityAmounts: z.number('Penality amount is required').array(),
	requestDate: z.string('Request date is required'),
	month: z.string('Month is required'),
	vat: z.number('VAT is required'),
	withhold: z.number('Withhold is required'),
	requestor: z.number('Requester is required')
});

export type AddRequest = z.infer<typeof add>;
