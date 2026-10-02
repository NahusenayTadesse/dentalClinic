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
import { hasPermission } from '$lib/server/permissions';
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

	const [rows, effect, form] = await Promise.all([
		remindersFor(locals.branch, day),
		reminderEffect(locals.branch),
		superValidate(zod4(logReminder))
	]);

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
		form
	};
};

export const actions: Actions = {
	/** A reminder given, owned by its appointment rather than by a patient's chart. */
	logReminder: (event) =>
		ownedAction(
			event,
			REMINDER_PERMISSION,
			logReminder,
			(data) => reminderOwner(event, data.appointmentId),
			(tx, { ownerId, data }) => recordReminder(tx, event, ownerId, { confirmed: data.confirmed })
		)
};
