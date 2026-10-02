import { fail } from '@sveltejs/kit';
import { superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';

import { ownedAction } from '$lib/server/patientAction';
import {
	EFFECT_WINDOW_DAYS,
	REMINDER_PERMISSION,
	recordReminder,
	reminderEffect,
	reminderOwner,
	remindersFor
} from '$lib/server/reminders';
import { hasPermission, requirePermission } from '$lib/server/permissions';
import { describeOutcome, smsReady, textReminder, textedAppointments } from '$lib/server/sms';
import { messagesFor } from '$lib/i18n/messages';
import { textState } from '$lib/smsTemplates';
import { addClinicDays, clinicToday, isIsoDate } from '$lib/clinicTime';
import { logReminder } from './schema';
import type { Actions, PageServerLoad } from './$types';

/**
 * Who to remind: the appointments on one day at the working branch that are still to come,
 * earliest first. Tomorrow by default, because that is the call the desk makes each afternoon;
 * `?date=YYYY-MM-DD` picks another day.
 *
 * Reading it is `appointments.view` (the diary's gate); recording a reminder is
 * `appointments.book`, checked in the action.
 */
export const load: PageServerLoad = async ({ url, locals }) => {
	const today = clinicToday();
	const asked = url.searchParams.get('date');
	const day = isIsoDate(asked) ? asked : addClinicDays(today, 1);

	const [found, effect, form, canText] = await Promise.all([
		remindersFor(locals.branch, day),
		reminderEffect(locals.branch),
		superValidate(zod4(logReminder)),
		smsReady()
	]);
	// Whether each patient can be texted, by the rule the server sends by (`textState`).
	const texted = await textedAppointments(found.map((r) => r.id));
	const rows = found.map((row) => {
		const at = texted.get(row.id) ?? null;
		return { ...row, sms: { state: textState(row.phone, row.smsOptOut, at), at } };
	});

	return {
		day,
		today,
		tomorrow: addClinicDays(today, 1),
		previousDay: addClinicDays(day, -1),
		nextDay: addClinicDays(day, 1),
		rows,
		effect,
		effectWindow: EFFECT_WINDOW_DAYS,
		canRemind: hasPermission(locals, REMINDER_PERMISSION),
		canText,
		form
	};
};

/** The id an SMS button posted, or null. */
async function postedId(request: Request, field: string): Promise<number | null> {
	const id = Number((await request.formData()).get(field));
	return Number.isInteger(id) && id > 0 ? id : null;
}

export const actions: Actions = {
	/**
	 * Texts one patient their reminder. Not in a transaction: the gateway can take seconds. A text
	 * that goes out stamps the reminder (`textReminder`), as a call would.
	 */
	textReminder: async (event) => {
		requirePermission(event.locals, REMINDER_PERMISSION);
		const words = messagesFor(event.locals.lang).common.sms;
		const id = await postedId(event.request, 'appointmentId');
		const outcome = id ? await textReminder(event, id) : null;
		if (!outcome) return fail(404, { message: { type: 'error', text: words.notFound } });
		const reply = describeOutcome(outcome, event.locals.lang);
		return reply.type === 'success' ? { message: reply } : fail(400, { message: reply });
	},

	/**
	 * Texts everyone on the day not yet reminded or texted, one at a time — each send is its own
	 * log row and its own failure, so one bad number does not stop the rest.
	 */
	textAll: async (event) => {
		requirePermission(event.locals, REMINDER_PERMISSION);
		const words = messagesFor(event.locals.lang).common.sms;
		const asked = String((await event.request.formData()).get('date') ?? '');
		if (!isIsoDate(asked)) return fail(400, { message: { type: 'error', text: words.notFound } });

		const rows = await remindersFor(event.locals.branch, asked);
		const texted = await textedAppointments(rows.map((r) => r.id));
		const due = rows.filter(
			(r) =>
				r.reminderSentAt === null &&
				textState(r.phone, r.smsOptOut, texted.get(r.id) ?? null) === 'ready'
		);
		if (due.length === 0) return { message: { type: 'success', text: words.noneToSend } };

		const tally = { sent: 0, skipped: 0, failed: 0 };
		for (const row of due) {
			const outcome = await textReminder(event, row.id);
			if (!outcome || outcome.status === 'skipped') tally.skipped++;
			else tally[outcome.status]++;
		}
		const text = words.summary(tally.sent, tally.skipped, tally.failed);
		return { message: { type: tally.failed ? 'error' : 'success', text } };
	},

	/** A reminder given, owned by its appointment rather than by a patient's chart. */
	logReminder: (event) =>
		ownedAction(
			event,
			REMINDER_PERMISSION,
			logReminder,
			(data) => reminderOwner(event, data.appointmentId),
			(tx, { ownerId, data }) =>
				recordReminder(tx, event, ownerId, {
					confirmed: data.confirmed,
					lang: event.locals.lang
				})
		)
};
