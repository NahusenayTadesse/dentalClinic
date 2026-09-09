import { z } from 'zod/v4';

export const editUserSchema = z.object({
	email: z.email('Email is required'),
	name: z.string('Name is required').min(2).max(100),
	role: z.coerce.number(),
	status: z.boolean().default(true),
	permissionsList: z.array(z.number()).nonempty('At least one permission must be selected'),
	editPermission: z.boolean().default(false)
});
