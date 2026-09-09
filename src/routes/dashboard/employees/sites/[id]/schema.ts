import type { Description } from '$lib/components/ui/sheet';
import { z } from 'zod/v4';

export const edit = z.object({
	id: z.number('Tax type not found'),
	day: z.string('Days are required'),
	reason: z.string('Reason are required'),
	deductable: z.boolean('Deductable is required').default(false),
	deductableAmount: z.string('Deductable is required').optional(),
	status: z.boolean('Status is required').default(true)
});
export type Edit = z.infer<typeof edit>;
