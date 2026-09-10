import { z } from 'zod/v4';

/**
 * The first administrator's account.
 *
 * The password rules match `change-password` and `reset-password`. The ceiling is not cosmetic:
 * hashing is deliberately slow, so an unbounded field is free work for the server on a route
 * that, by necessity, no one has signed in to reach.
 */
export const setupSchema = z
	.object({
		name: z.string().trim().min(2, 'Enter your name').max(150),
		email: z.email('Enter a valid email address'),
		password: z
			.string()
			.min(8, 'Password must be at least 8 characters')
			.max(200, 'That password is too long')
			.regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
			.regex(/[a-z]/, 'Password must contain at least one lowercase letter')
			.regex(/[0-9]/, 'Password must contain at least one number')
			.regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
		confirmPassword: z.string().max(200)
	})
	.refine((data) => data.password === data.confirmPassword, {
		message: 'The two passwords do not match',
		path: ['confirmPassword']
	});
