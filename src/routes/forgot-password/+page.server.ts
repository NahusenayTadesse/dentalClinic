import { fail } from '@sveltejs/kit';
import { message, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { redirect } from 'sveltekit-flash-message/server';

import { auth } from '$lib/server/auth';
import { ForgotPasswordSchema } from './schema';
import type { Actions, PageServerLoad } from './$types';

/**
 * "I have forgotten my password."
 *
 * One email field, and the answer is always the same sentence. That is the point: this endpoint
 * is reachable by anyone, and a response that differed for a known address would turn it into an
 * account-enumeration oracle. Better Auth's `requestPasswordReset` already answers 200 either
 * way, so the uniformity here is mostly about not undoing that — the failure branch says exactly
 * what the success branch says.
 *
 * This replaces a flow that generated a new password and mailed it in plaintext to anyone who
 * typed a known address.
 */
export const load: PageServerLoad = async (event) => {
	if (event.locals.user) {
		return redirect(302, '/dashboard');
	}

	return { form: await superValidate(zod4(ForgotPasswordSchema)) };
};

/** Said whatever happened, so the page cannot be used to test whether an account exists. */
const SENT =
	'If that email address has an account, a reset link is on its way. It expires in an hour.';

export const actions: Actions = {
	forgotPassword: async (event) => {
		const form = await superValidate(event.request, zod4(ForgotPasswordSchema));

		if (!form.valid) {
			return fail(400, { form });
		}

		try {
			await auth.api.requestPasswordReset({
				// Where the link lands. Better Auth appends its own `?token=`.
				body: { email: form.data.email, redirectTo: '/reset-password' },
				headers: event.request.headers
			});
		} catch (err) {
			// Logged, never shown. A mail failure and an unknown account must be indistinguishable
			// from outside, but the difference matters in the server log when somebody reports
			// that the email never arrived.
			console.error('password reset request failed', err);
		}

		return message(form, { type: 'success', text: SENT });
	}
};
