import { fail } from '@sveltejs/kit';
import { message, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { redirect } from 'sveltekit-flash-message/server';

import { auth } from '$lib/server/auth';
import { resetPasswordSchema } from './schema';
import type { Actions, PageServerLoad } from './$types';

/**
 * Choosing a new password, from the link in the reset email.
 *
 * The token rides in a hidden field rather than being re-read from the URL at submit time, so
 * the value validated on the way in is the value that gets used.
 */
export const load: PageServerLoad = async (event) => {
	if (event.locals.user) {
		return redirect(302, '/dashboard');
	}

	const token = event.url.searchParams.get('token') ?? '';
	const form = await superValidate(zod4(resetPasswordSchema));

	form.data.token = token;

	// A missing token means the link was mangled in transit — a mail client wrapping a long URL
	// is the usual cause. Say so, rather than showing a form that cannot possibly work.
	return { form, hasToken: Boolean(token) };
};

export const actions: Actions = {
	default: async (event) => {
		const form = await superValidate(event.request, zod4(resetPasswordSchema));

		if (!form.valid) {
			return fail(400, { form });
		}

		try {
			await auth.api.resetPassword({
				body: { token: form.data.token, newPassword: form.data.newPassword },
				headers: event.request.headers
			});
		} catch {
			// An expired token, an already-used one and a forged one all land here and all get the
			// same sentence. There is nothing useful to tell them apart for, and the honest advice
			// is identical in every case.
			return message(
				form,
				{
					type: 'error',
					text: 'That reset link is no longer valid. Request a new one and use it within the hour.'
				},
				{ status: 400 }
			);
		}

		// Not signed in on the way out, deliberately: `revokeSessionsOnPasswordReset` has just
		// ended every session, and the person should prove the new password works while they
		// still remember choosing it.
		return redirect(
			'/login?reset=1',
			{ type: 'success', message: 'Password updated. Please sign in.' },
			event.cookies
		);
	}
};
