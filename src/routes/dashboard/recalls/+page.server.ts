import { superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';

import { ownedAction } from '$lib/server/patientAction';
import {
	MAX_ATTEMPTS,
	RECALL_PERMISSION,
	dueRecalls,
	logRecallCall,
	recallSummary
} from '$lib/server/recalls';
import { addClinicDays, clinicToday } from '$lib/clinicTime';
import { logCall } from './schema';
import type { Actions, PageServerLoad } from './$types';

/** How far ahead the list looks, in days. The desk rings the overdue first and books ahead. */
const WINDOWS = [0, 14, 30, 60] as const;

/**
 * The recall list: patients at this branch due back by the end of the window, the longest overdue
 * first, with how often each has been rung. **Book** opens the diary with the patient and the kind
 * of visit chosen; the booking answers the recall by itself (`server/recalls.ts`).
 *
 * Gated by `appointments.book` (`routeRules`), which the call action checks again.
 */
export const load: PageServerLoad = async ({ url, locals }) => {
	const asked = Number(url.searchParams.get('within'));
	const within = (WINDOWS as readonly number[]).includes(asked) ? asked : 30;
	const until = addClinicDays(clinicToday(), within);

	const [recalls, summary, form] = await Promise.all([
		dueRecalls(locals.branch, until),
		recallSummary(locals.branch, until),
		superValidate(zod4(logCall))
	]);

	return { recalls, summary, within, windows: WINDOWS, maxAttempts: MAX_ATTEMPTS, form };
};

export const actions: Actions = {
	/** A call logged against one recall. Not a patient's chart write, so the owner is the recall. */
	logCall: (event) =>
		ownedAction(
			event,
			RECALL_PERMISSION,
			logCall,
			async (data) => data.recallId,
			async (tx, { ownerId, data }) => {
				await logRecallCall(tx, event.locals.user?.id, ownerId, {
					outcome: data.outcome,
					note: data.note ?? null
				});
				return {
					noAnswer: 'Call logged — no answer.',
					callBack: 'Call logged. Ring again when they asked.',
					declined: 'Marked declined. They will not be rung again for this recall.',
					stopped: 'Recall stopped.'
				}[data.outcome];
			}
		)
};
