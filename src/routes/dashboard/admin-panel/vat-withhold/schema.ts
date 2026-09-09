import { z } from 'zod/v4';

export const add = z.object({
	vat: z.coerce.number('Vat is required'),
	withHold: z.coerce.number('Withhold is required')
});
