import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';

import { db } from './db';
import { appointment, branch, patient } from './db/schema';
import { inRollback, type TestTx } from '$lib/testing/rollback';
import { insertReturningId } from '@nahu/admin-kit/server/db/insert.js';
import { addClinicDays, clinicToday, fromClinic } from '$lib/clinicTime';
import { WriteRefused } from './childCrud';
import { recordReminder, reminderEffect } from './reminders';

const event = { locals: { user: null }, getClientAddress: () => '127.0.0.1' };

/**
 * A reminder stamps the appointment and, when the patient says they will come, confirms it — only
 * from `scheduled`, through the status table. The no-show comparison counts attended and missed
 * visits by whether they were reminded. A patient and a branch are borrowed; appointments are made
 * inside rollbacks.
 */
describe('reminders', async () => {
	const [someone] = await db.select({ id: patient.id }).from(patient).limit(1);
	const [here] = await db.select({ id: branch.id }).from(branch).limit(1);
	const ready = Boolean(someone && here);

	async function booked(
		tx: TestTx,
		status: 'scheduled' | 'confirmed' | 'completed' | 'noShow' | 'cancelled',
		day = addClinicDays(clinicToday(), 1),
		reminderSentAt: Date | null = null
	) {
		return insertReturningId(tx, appointment, {
			patientId: someone.id,
			branchId: here.id,
			startsAt: fromClinic(day, '09:00'),
			status,
			reminderSentAt
		});
	}
	const read = (tx: TestTx, id: number) =>
		tx
			.select()
			.from(appointment)
			.where(eq(appointment.id, id))
			.then(([row]) => row);

	it.skipIf(!ready)('stamps the reminder, and confirms only when asked', async () => {
		const result = await inRollback(async (tx) => {
			const plain = await booked(tx, 'scheduled');
			const plainText = await recordReminder(tx, event, plain, { confirmed: false });
			const yes = await booked(tx, 'scheduled');
			const yesText = await recordReminder(tx, event, yes, { confirmed: true });
			const already = await booked(tx, 'confirmed');
			const alreadyText = await recordReminder(tx, event, already, { confirmed: true });
			return {
				plain: await read(tx, plain),
				plainText,
				yes: await read(tx, yes),
				yesText,
				alreadyText
			};
		});

		expect(result.plain.reminderSentAt).not.toBeNull();
		expect(result.plain.status).toBe('scheduled');
		expect(result.plain.confirmedAt).toBeNull();
		expect(result.plainText).toBe('Reminder recorded');
		expect(result.yes.status).toBe('confirmed');
		expect(result.yes.confirmedAt).not.toBeNull();
		expect(result.yesText).toBe('Reminded, and marked confirmed');
		expect(result.alreadyText).toBe('Reminded — already confirmed');
	});

	it.skipIf(!ready)('refuses a visit that is no longer to come', async () => {
		await expect(
			inRollback(async (tx) => {
				const gone = await booked(tx, 'cancelled');
				await recordReminder(tx, event, gone, { confirmed: false });
			})
		).rejects.toBeInstanceOf(WriteRefused);
	});

	it.skipIf(!ready)('compares no-shows among the reminded and the rest', async () => {
		const result = await inRollback(async (tx) => {
			const before = await reminderEffect({ active: here.id }, tx);
			const lastWeek = addClinicDays(clinicToday(), -7);
			const rang = new Date();
			await booked(tx, 'completed', lastWeek, rang);
			await booked(tx, 'completed', lastWeek, rang);
			await booked(tx, 'completed', lastWeek, rang);
			await booked(tx, 'noShow', lastWeek, rang);
			await booked(tx, 'noShow', lastWeek);
			await booked(tx, 'completed', lastWeek);
			// Cancelled, and still to come: neither is counted.
			await booked(tx, 'cancelled', lastWeek, rang);
			await booked(tx, 'scheduled');
			return { before, after: await reminderEffect({ active: here.id }, tx) };
		});

		expect(result.after.reminded.visits - result.before.reminded.visits).toBe(4);
		expect(result.after.reminded.noShows - result.before.reminded.noShows).toBe(1);
		expect(result.after.notReminded.visits - result.before.notReminded.visits).toBe(2);
		expect(result.after.notReminded.noShows - result.before.notReminded.noShows).toBe(1);
	});
});
