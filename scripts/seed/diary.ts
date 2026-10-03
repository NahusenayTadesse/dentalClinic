/**
 * Moves the seeded diary so it is centred on today again: `npm run db:seed -- --yes --to-today`.
 *
 * The scheduling seed books four weeks around the day it runs, so a database seeded a month ago has
 * nothing ahead of it — the day view, reminders and the board all look empty, and a demo is a demo
 * of last month. This finds the block of appointments the seed made (those created on the day the
 * first appointment was) and moves every one of its times by the same whole number of days, so the
 * block's middle lands on today. Each appointment keeps its status, chair and length; only its day
 * moves.
 *
 * Run twice, it does nothing the second time: the block's middle is already today. Appointments
 * booked in the app afterwards are left alone — they were booked against a real today.
 *
 * Non-goal: moving everything else that has a date (bills, procedures, payments). They are history,
 * and history a month older is still history; only the diary has a "today" in it.
 */
import { eq, sql } from 'drizzle-orm';

import { appointment } from '../../src/lib/server/db/schema/scheduling';
import { type SeedDb } from './util';

const DAY = 86_400_000;
const TIMES = [
	'startsAt',
	'arrivedAt',
	'seatedAt',
	'dismissedAt',
	'confirmedAt',
	'reminderSentAt',
	'cancelledAt'
] as const;

export async function moveDiaryToToday(db: SeedDb) {
	const rows = await db
		.select({
			id: appointment.id,
			createdAt: appointment.createdAt,
			startsAt: appointment.startsAt,
			arrivedAt: appointment.arrivedAt,
			seatedAt: appointment.seatedAt,
			dismissedAt: appointment.dismissedAt,
			confirmedAt: appointment.confirmedAt,
			reminderSentAt: appointment.reminderSentAt,
			cancelledAt: appointment.cancelledAt
		})
		.from(appointment)
		.where(sql`${appointment.deletedAt} IS NULL`);
	if (!rows.length) {
		console.log('No appointments to move.');
		return;
	}

	const firstDay = Math.min(...rows.map((r) => Math.floor(r.createdAt.getTime() / DAY)));
	const seeded = rows.filter((r) => Math.floor(r.createdAt.getTime() / DAY) === firstDay);
	const starts = seeded.map((r) => r.startsAt.getTime());
	const middle = (Math.min(...starts) + Math.max(...starts)) / 2;
	const shift = Math.round((Date.now() - middle) / DAY);
	if (shift === 0) {
		console.log('The diary is already centred on today.');
		return;
	}

	for (const row of seeded) {
		const moved: Partial<Record<(typeof TIMES)[number], Date>> = {};
		for (const key of TIMES) {
			const at = row[key];
			if (at) moved[key] = new Date(at.getTime() + shift * DAY);
		}
		await db.update(appointment).set(moved).where(eq(appointment.id, row.id));
	}
	console.log(`Moved ${seeded.length} seeded appointments by ${shift} days.`);
}
