import { superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';

import { formAction } from '$lib/server/patientAction';
import {
	ATTENDANCE_PERMISSION,
	markScheduledIn,
	recordDay,
	register,
	type RegisterAct
} from '$lib/server/attendance';
import { markAllIn, registerAct } from '$lib/forms/attendance';
import { clinicClock, clinicToday, isIsoDate } from '$lib/clinicTime';
import { summarise } from '$lib/attendance';
import type { Actions, PageServerLoad } from './$types';

/**
 * The day's register: everyone at this branch, who is in, who has left, who has not come — kept by
 * tapping. `?day=` opens another day; it defaults to today. The month grid is `./month`.
 *
 * Gated by `attendance.manage` (`routeRules`), checked again by each action.
 */
export const load: PageServerLoad = async ({ url, locals }) => {
	const asked = url.searchParams.get('day');
	const today = clinicToday();
	const day = isIsoDate(asked) && asked <= today ? asked : today;

	// Three forms over one schema, each with its own id: superforms tells forms apart by id, and two
	// dialogs on one form would each receive the other's reply.
	const [rows, act, times, excuse, all] = await Promise.all([
		register(day, day, { branch: locals.branch }),
		superValidate(zod4(registerAct)),
		superValidate(zod4(registerAct), { id: 'attendance-times' }),
		superValidate(zod4(registerAct), { id: 'attendance-excuse' }),
		superValidate({ day }, zod4(markAllIn), { errors: false })
	]);

	const people = rows.map((row) => ({
		id: row.id,
		name: row.name,
		department: row.department,
		position: row.position,
		...row.days[day]
	}));
	const totals = summarise(people);
	return {
		day,
		today,
		isToday: day === today,
		people,
		totals: {
			...totals,
			scheduled: people.filter((p) => p.scheduled).length,
			waiting: people.filter((p) => p.kind === 'notYet' || p.kind === 'absent').length,
			stillIn: people.filter((p) => p.open).length
		},
		/** Those a one-tap "everyone in" would mark: scheduled, nothing recorded. */
		markable: people.filter(
			(p) =>
				!p.record &&
				p.scheduled &&
				(p.kind === 'notYet' || p.kind === 'absent' || p.kind === 'unjudged')
		).length,
		forms: { act, times, excuse, all }
	};
};

/**
 * The time an "in" or "out" means when none was typed: now on today's register, the schedule's
 * start or end on an earlier day — a past day is filled in from memory, and the schedule is the
 * best guess to correct from.
 */
async function defaultTime(
	day: string,
	staffId: number,
	which: 'start' | 'end',
	branch: App.Locals['branch']
): Promise<string> {
	if (day === clinicToday()) return clinicClock(new Date());
	const [row] = await register(day, day, { branch, staffIds: [staffId] });
	const scheduled = row?.days[day]?.scheduled;
	return (scheduled ? scheduled[which] : which === 'start' ? '08:30' : '17:00').slice(0, 5);
}

export const actions: Actions = {
	record: (event) =>
		formAction(event, ATTENDANCE_PERMISSION, registerAct, async (data) => {
			let act: RegisterAct;
			switch (data.act) {
				case 'in':
					act = {
						act: 'in',
						time:
							data.clockIn ||
							(await defaultTime(data.day, data.staffId, 'start', event.locals.branch))
					};
					break;
				case 'out':
					act = {
						act: 'out',
						time:
							data.clockOut ||
							(await defaultTime(data.day, data.staffId, 'end', event.locals.branch))
					};
					break;
				case 'times':
					act = { act: 'times', clockIn: data.clockIn ?? '', clockOut: data.clockOut || null };
					break;
				case 'excuse':
					act = { act: 'excuse', note: data.note ?? '' };
					break;
				case 'clear':
					act = { act: 'clear' };
					break;
			}
			return (tx) => recordDay(tx, event, data.staffId, data.day, act);
		}),

	markAllIn: (event) =>
		formAction(event, ATTENDANCE_PERMISSION, markAllIn, async (data) => async (tx) => {
			const marked = await markScheduledIn(tx, event, data.day);
			return marked
				? `${marked} marked in at their scheduled start. Correct anyone who was late.`
				: 'Everyone scheduled is already recorded.';
		})
};
