import { fail } from '@sveltejs/kit';
import { message, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { redirect } from 'sveltekit-flash-message/server';

import { auth } from '$lib/server/auth';
import { changePasswordSchema } from './schema';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	if (!event.locals.user) {
		return redirect(302, '/login');
	}

	return { form: await superValidate(zod4(changePasswordSchema)) };
};

export const actions: Actions = {
	changePassword: async (event) => {
		const form = await superValidate(event.request, zod4(changePasswordSchema));

		if (!form.valid) {
			return fail(400, { form });
		}

		try {
			await auth.api.changePassword({
				body: {
					currentPassword: form.data.currentPassword,
					newPassword: form.data.newPassword,
					// Someone changing a password they think has been seen has fixed nothing while
					// the old session is still open on the machine that saw it.
					revokeOtherSessions: true
				},
				// Better Auth reads the session from the cookie on these headers and writes the
				// replacement cookie back through the SvelteKit cookies plugin, which is why
				// revoking the others does not sign out the person doing the changing.
				headers: event.request.headers,
				asResponse: false
			});
		} catch (err) {
			// The only failure worth naming: guessing at the rest sends people looking in the
			// wrong place.
			const code = (err as { body?: { code?: string } })?.body?.code;

			if (code === 'INVALID_PASSWORD') {
				return message(
					form,
					{ type: 'error', text: 'That is not your current password.' },
					{ status: 400 }
				);
			}

			console.error('password change failed', err);

			return message(
				form,
				{ type: 'error', text: 'The password could not be changed. Please try again.' },
				{ status: 500 }
			);
		}

		return message(form, {
			type: 'success',
			text: 'Password changed. Any other device signed in as you has been signed out.'
		});
	}
};
