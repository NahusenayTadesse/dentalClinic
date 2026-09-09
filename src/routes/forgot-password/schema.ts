import { z } from 'zod/v4';

export const ForgotPasswordSchema = z.object({
	email: z.email('Email is required')
});
