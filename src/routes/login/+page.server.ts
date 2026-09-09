import { fail } from '@sveltejs/kit';
import { message, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { redirect } from 'sveltekit-flash-message/server';

import { auth } from '$lib/server/auth';
import { loginSchema } from '$lib/ZodSchema';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	if (event.locals.user) {
		return redirect(302, '/dashboard');
	}

	return {
		form: await superValidate(zod4(loginSchema)),
		// Set by `/reset-password` on its way out. Every session was revoked, so the form is
		// expected — but landing on a bare login screen after successfully choosing a password
		// reads as though it did not work.
		reset: event.url.searchParams.has('reset')
	};
};

export const actions: Actions = {
	login: async (event) => {
		const form = await superValidate(event.request, zod4(loginSchema));

		if (!form.valid) {
			return fail(400, { form });
		}

		try {
			await auth.api.signInEmail({
				body: { email: form.data.email, password: form.data.password },
				headers: event.request.headers,
				asResponse: false
			});
		} catch {
			// Deliberately identical for an unknown email, a wrong password, and an account the
			// session hook refuses (inactive, soft-deleted, or banned). Distinguishing them turns
			// this form into an account-enumeration oracle.
			return message(
				form,
				{ type: 'error', text: 'That email and password did not match.' },
				{ status: 401 }
			);
		}

		// Only same-origin paths. `startsWith('/')` alone is not enough: `//evil.com` and
		// `/\evil.com` both start with a slash and both resolve to another host, so the second
		// character has to be excluded too. An open redirect on a login form is a phishing step.
		const redirectTo = event.url.searchParams.get('redirectTo');
		const isSameOrigin = Boolean(redirectTo && /^\/(?![/\\])/.test(redirectTo));

		return redirect(
			isSameOrigin ? redirectTo! : '/dashboard',
			{ type: 'success', message: 'Login Successful' },
			event.cookies
		);
	}
};
