import type { Description } from '$lib/components/ui/sheet';
import { z } from 'zod/v4';

export const add = z.object({
	name: z.string('Name of Overtime Type is required').min(2).max(50),
	rate: z.number('Rate is required'),
	maxhours: z.number('Max hours is required'),
	status: z.boolean('Status is required').default(true)
});

export const edit = z.object({
	id: z.number('Overtime type not found'),
	name: z.string('Name of Overtime Type is required').min(2).max(50),
	rate: z.number('Rate is required'),
	maxhours: z.number('Max hours is required'),
	status: z.boolean('Status is required').default(true)
});
export type Edit = z.infer<typeof edit>;
