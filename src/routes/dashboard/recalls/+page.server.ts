import { fail } from '@sveltejs/kit';
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
import { messagesFor } from '$lib/i18n/messages';
import { requirePermission } from '$lib/server/permissions';
import { describeOutcome, smsReady, textRecall, textedRecalls } from '$lib/server/sms';
import { textState } from '$lib/smsTemplates';
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

	const [found, summary, form, canText] = await Promise.all([
		dueRecalls(locals.branch, until),
		recallSummary(locals.branch, until),
		superValidate(zod4(logCall)),
		smsReady()
	]);
	// Whether each patient can be texted, by the rule the server sends by (`textState`).
	const texted = await textedRecalls(found.map((r) => r.id));
	const recalls = found.map((row) => {
		const at = texted.get(row.id) ?? null;
		return { ...row, sms: { state: textState(row.phone, row.smsOptOut, at), at } };
	});

	return {
		recalls,
		summary,
		within,
		windows: WINDOWS,
		maxAttempts: MAX_ATTEMPTS,
		canText,
		form
	};
};

export const actions: Actions = {
	/** Texts one patient the recall message. Not in a transaction: the gateway can take seconds. */
	textRecall: async (event) => {
		requirePermission(event.locals, RECALL_PERMISSION);
		const words = messagesFor(event.locals.lang).common.sms;
		const id = Number((await event.request.formData()).get('recallId'));
		const outcome = Number.isInteger(id) && id > 0 ? await textRecall(event, id) : null;
		if (!outcome) return fail(404, { message: { type: 'error', text: words.notFound } });
		const reply = describeOutcome(outcome, event.locals.lang);
		return reply.type === 'success' ? { message: reply } : fail(400, { message: reply });
	},

	/** A call logged against one recall. Not a patient's chart write, so the owner is the recall. */
	logCall: (event) =>
		ownedAction(
			event,
			RECALL_PERMISSION,
			logCall,
			async (data) => data.recallId,
			async (tx, { ownerId, data }) => {
				const say = messagesFor(event.locals.lang).appointments.toast;
				await logRecallCall(tx, event.locals.user?.id, ownerId, {
					outcome: data.outcome,
					note: data.note ?? null,
					lang: event.locals.lang
				});
				return {
					noAnswer: say.callNoAnswer,
					callBack: say.callBack,
					declined: say.callDeclined,
					stopped: say.callStopped
				}[data.outcome];
			}
		)
};
