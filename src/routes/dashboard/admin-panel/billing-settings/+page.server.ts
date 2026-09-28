import { message, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { eq } from 'drizzle-orm';

import { db } from '$lib/server/db';
import { clinicSettings } from '$lib/server/db/schema';
import { readSettings } from '$lib/server/settings';
import { billingSettings } from './schema';
import type { Actions, PageServerLoad } from './$types';

/**
 * How big a discount the front desk may give without a manager. Under the admin panel, so gated by
 * `settings.manage`. The row is written, never inserted here: migration 0036 creates it, and a
 * database without it saves nothing rather than inventing a second settings row.
 */
export const load: PageServerLoad = async () => {
	const settings = await readSettings();
	return { form: await superValidate(settings, zod4(billingSettings)) };
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const form = await superValidate(request, zod4(billingSettings));
		if (!form.valid)
			return message(form, { type: 'error', text: 'Check the form.' }, { status: 400 });
		await db
			.update(clinicSettings)
			.set({
				discountApprovalPercent: form.data.discountApprovalPercent,
				updatedBy: locals.user?.id
			})
			.where(eq(clinicSettings.id, 1));
		return message(form, { type: 'success', text: 'Saved.' });
	}
};
