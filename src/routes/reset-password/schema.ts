import { z } from 'zod/v4';

/**
 * The password rules match `change-password/schema.ts`. The ceiling is not cosmetic — hashing is
 * deliberately slow, so an unbounded field is free work for the server on an unauthenticated
 * request.
 */
export const resetPasswordSchema = z
	.object({
		token: z.string().min(1),
		newPassword: z
			.string()
			.min(8, 'Password must be at least 8 characters')
			.max(200, 'That password is too long')
			.regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
			.regex(/[a-z]/, 'Password must contain at least one lowercase letter')
			.regex(/[0-9]/, 'Password must contain at least one number')
			.regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
		confirmPassword: z.string().max(200)
	})
	.refine((data) => data.newPassword === data.confirmPassword, {
		message: 'The two passwords do not match',
		path: ['confirmPassword']
	});
