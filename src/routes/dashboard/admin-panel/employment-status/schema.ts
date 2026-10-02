import type { Description } from '@nahu/admin-kit/components/ui/sheet/index.js';
import { z } from 'zod/v4';

export const add = z.object({
	name: z.string('Name of Payment Method is required').min(2).max(50),
	description: z.string('Description is required').min(2).max(100),
	terminationStatus: z.boolean().default(false),
	status: z.boolean('Status is required').default(true),
	removeFromLists: z.boolean('Remove from lists is required').default(false)
});

export const edit = z.object({
	id: z.coerce.string(),
	name: z.string('Name of Payment Method is required').min(2).max(50),
	description: z.string('Description is required').min(2).max(100),
	terminationStatus: z.boolean().default(false),
	status: z.boolean('Status is required').default(true),
	removeFromLists: z.boolean('Remove from lists is required').default(false)
});
export type Edit = z.infer<typeof edit>;
