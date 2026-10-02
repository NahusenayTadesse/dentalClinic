import { z } from 'zod/v4';

export const editUserSchema = z.object({
	email: z.email('Email is required'),
	name: z.string('Name is required').min(2).max(100),
	role: z.coerce.number(),
	status: z.boolean().default(true),
	// Checked for emptiness on the server, and only when the user is given their own set: a
	// `nonempty` here refused every save of a user whose permissions were not being touched.
	permissionsList: z.array(z.number()).default([]),
	editPermission: z.boolean().default(false)
});
