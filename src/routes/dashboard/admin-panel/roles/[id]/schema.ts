import { z } from 'zod/v4';

export const editRoleSchema = z.object({
	name: z
		.string()
		.min(1, 'Role name is required')
		.max(100, 'Role name must be under 100 characters'),

	description: z
		.string()
		.min(1, 'Role description is required')
		.max(500, 'Role description must be under 500 characters'),

	permissions: z.array(z.number()).nonempty('At least one permission must be selected')
});
