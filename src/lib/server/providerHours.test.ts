import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';

import { db } from './db';
import { leave, provider, staffSchedule } from './db/schema';
import { inRollback } from '$lib/testing/rollback';
import { fromClinic } from '$lib/clinicTime';
import { outsideHours, providerAvailability } from './providerHours';

/**
 * The reader behind the booking warning: the provider's employee's schedule and approved leave,
 * found across the provider → employee link. A provider is borrowed; their schedule and leave are
 * replaced inside the rollback so whatever the clinic typed does not decide the answer.
 */
describe('providerHours', async () => {
	const [dentist] = await db
		.select({ id: provider.id, employeeId: provider.employeeId })
		.from(provider)
		.limit(1);

	// 2026-10-05 is a Monday.
	const monday = '2026-10-05';

	it.skipIf(!dentist)('reads hours and approved leave, and ignores the rest', async () => {
		const result = await inRollback(async (tx) => {
			await tx.delete(staffSchedule).where(eq(staffSchedule.staffId, dentist.employeeId));
			await tx.delete(leave).where(eq(leave.staffId, dentist.employeeId));

			const none = await outsideHours(tx, {
				providerId: dentist.id,
				startsAt: fromClinic(monday, '22:00'),
				durationMinutes: 30
			});

			await tx.insert(staffSchedule).values([
				{ staffId: dentist.employeeId, weekDay: 0, startTime: '08:30', endTime: '12:30' },
				// Switched off on the Schedule section: not a stretch they work.
				{
					staffId: dentist.employeeId,
					weekDay: 0,
					startTime: '13:00',
					endTime: '17:00',
					isActive: false
				}
			]);
			const slot = (time: string) =>
				outsideHours(tx, {
					providerId: dentist.id,
					startsAt: fromClinic(monday, time),
					durationMinutes: 30
				});
			const inside = await slot('09:00');
			const afternoon = await slot('14:00');

			const request = { staffId: dentist.employeeId, requestDate: new Date(`${monday}T00:00:00Z`) };
			await tx.insert(leave).values([
				{
					...request,
					startDate: new Date(`${monday}T00:00:00Z`),
					endDate: new Date(`${monday}T00:00:00Z`),
					status: 'pending'
				}
			]);
			const pending = await slot('09:00');
			await tx.insert(leave).values([
				{
					...request,
					startDate: new Date('2026-10-04T00:00:00Z'),
					endDate: new Date('2026-10-06T00:00:00Z'),
					status: 'approved'
				}
			]);
			const onLeave = await slot('09:00');
			const later = (await providerAvailability(tx, [dentist.id], '2026-10-07')).get(dentist.id);

			return { none, inside, afternoon, pending, onLeave, later };
		});

		expect(result.none).toEqual([]);
		expect(result.inside).toEqual([]);
		expect(result.afternoon).toHaveLength(1);
		expect(result.afternoon[0]).toContain('08:30–12:30 on Mondays');
		expect(result.pending).toEqual([]);
		expect(result.onLeave).toHaveLength(1);
		expect(result.onLeave[0]).toContain('on approved leave');
		// Leave over before the day asked from is not handed to the dialogs.
		expect(result.later?.leave).toEqual([]);
	});

	it('says nothing without a dentist', async () => {
		expect(
			await outsideHours(db, {
				providerId: null,
				startsAt: fromClinic(monday, '22:00'),
				durationMinutes: 30
			})
		).toEqual([]);
	});
});
