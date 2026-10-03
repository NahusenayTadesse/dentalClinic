import { message, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { and, count, eq } from 'drizzle-orm';

import { db } from '$lib/server/db';
import { clinicSettings, dataBreach } from '$lib/server/db/schema';
import { readSettings } from '$lib/server/settings';
import { notDeleted } from '$lib/server/softDelete';
import { pastRetention } from '$lib/server/privacy';
import { retention } from './schema';
import type { Actions, PageServerLoad } from './$types';

/**
 * Data protection at a glance: how long records are kept, the records past that and due a review,
 * and how many breaches are still open. Gated with the rest of the Admin Panel (`settings.manage`).
 * The patient's copy of their record is on their chart; who opened a chart is its access log.
 */
export const load: PageServerLoad = async () => {
	const settings = await readSettings();
	const [due, [open]] = await Promise.all([
		pastRetention(settings.recordRetentionYears),
		db
			.select({ n: count() })
			.from(dataBreach)
			.where(and(eq(dataBreach.isActive, true), notDeleted(dataBreach)))
	]);
	return {
		years: settings.recordRetentionYears,
		due,
		openBreaches: open?.n ?? 0,
		form: await superValidate(
			{ recordRetentionYears: settings.recordRetentionYears },
			zod4(retention)
		)
	};
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const form = await superValidate(request, zod4(retention));
		if (!form.valid)
			return message(form, { type: 'error', text: 'Check the form.' }, { status: 400 });
		await db
			.update(clinicSettings)
			.set({ recordRetentionYears: form.data.recordRetentionYears, updatedBy: locals.user?.id })
			.where(eq(clinicSettings.id, 1));
		return message(form, { type: 'success', text: 'Saved.' });
	}
};
