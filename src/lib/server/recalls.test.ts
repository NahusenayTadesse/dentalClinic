import { describe, expect, it } from 'vitest';
import { and, eq, isNotNull } from 'drizzle-orm';

import { db } from './db';
import { appointment, appointmentType, patient, recall } from './db/schema';
import { inRollback, type TestTx } from '$lib/testing/rollback';
import { addClinicMonths } from '$lib/clinicTime';
import { insertReturningId } from '@nahu/admin-kit/server/db/insert.js';
import { WriteRefused } from './childCrud';
import {
	dueRecalls,
	logRecallCall,
	recallAfterVisit,
	recallOnBooking,
	recallReleased
} from './recalls';

/**
 * A recall's whole life is driven by the diary, so these follow one through it: a check-up
 * completed starts the next, a booking answers it, a cancellation reopens it, the visit closes it.
 * Built inside rollbacks; a patient and a type that recalls are borrowed.
 */
describe('recalls', async () => {
	const [someone] = await db.select({ id: patient.id }).from(patient).limit(1);
	const [checkUp] = await db
		.select({ id: appointmentType.id, months: appointmentType.recallIntervalMonths })
		.from(appointmentType)
		.where(isNotNull(appointmentType.recallIntervalMonths))
		.limit(1);
	const ready = Boolean(someone && checkUp?.months);

	/** An appointment of the check-up type on this clinic date. */
	async function visit(tx: TestTx, day: string) {
		const startsAt = new Date(`${day}T06:00:00Z`);
		const id = await insertReturningId(tx, appointment, {
			patientId: someone.id,
			appointmentTypeId: checkUp.id,
			startsAt,
			status: 'scheduled'
		});
		return { id, patientId: someone.id, appointmentTypeId: checkUp.id, branchId: null, startsAt };
	}
	const mine = (tx: TestTx) =>
		tx
			.select()
			.from(recall)
			.where(and(eq(recall.patientId, someone.id), eq(recall.appointmentTypeId, checkUp.id)));

	it.skipIf(!ready)('follows a recall from one check-up to the next', async () => {
		const result = await inRollback(async (tx) => {
			await tx.delete(recall).where(eq(recall.patientId, someone.id));
			const first = await visit(tx, '2026-03-15');
			const dueOn = await recallAfterVisit(tx, undefined, first);

			const next = await visit(tx, '2026-09-20');
			await recallOnBooking(tx, undefined, next);
			const afterBooking = (await mine(tx)).find((r) => r.dueOn === dueOn);

			await recallReleased(tx, undefined, next.id);
			const afterCancel = (await mine(tx)).find((r) => r.dueOn === dueOn);

			await recallOnBooking(tx, undefined, next);
			await recallAfterVisit(tx, undefined, next);
			const all = await mine(tx);
			return { dueOn, afterBooking, afterCancel, all, nextId: next.id };
		});
		expect(result.dueOn).toBe(addClinicMonths('2026-03-15', checkUp.months ?? 0));
		expect(result.afterBooking?.status).toBe('booked');
		expect(result.afterCancel?.status).toBe('due');
		expect(result.afterCancel?.scheduledAppointmentId).toBeNull();
		const answered = result.all.find((r) => r.dueOn === result.dueOn);
		expect(answered?.status).toBe('completed');
		expect(answered?.scheduledAppointmentId).toBe(result.nextId);
		// …and the visit that answered it starts the one after.
		expect(result.all.filter((r) => r.status === 'due')).toHaveLength(1);
	});

	it.skipIf(!ready)(
		'counts the calls, drops a declined recall from the list, and refuses a closed one',
		async () => {
			const result = await inRollback(async (tx) => {
				await tx.delete(recall).where(eq(recall.patientId, someone.id));
				const id = await insertReturningId(tx, recall, {
					patientId: someone.id,
					appointmentTypeId: checkUp.id,
					dueOn: '2026-01-10',
					status: 'due'
				});
				await logRecallCall(tx, undefined, id, { outcome: 'noAnswer', note: null });
				const listed = (await dueRecalls({ active: null }, '2026-12-31', tx)).find(
					(r) => r.id === id
				);
				await logRecallCall(tx, undefined, id, { outcome: 'declined', note: 'Moved to Hawassa' });
				const after = (await dueRecalls({ active: null }, '2026-12-31', tx)).find(
					(r) => r.id === id
				);
				let refused: string | null = null;
				try {
					await logRecallCall(tx, undefined, id, { outcome: 'noAnswer', note: null });
				} catch (err) {
					if (err instanceof WriteRefused) refused = err.message;
					else throw err;
				}
				const [row] = await tx.select().from(recall).where(eq(recall.id, id));
				return { listed, after, refused, row };
			});
			expect(result.listed?.attempts).toBe(1);
			expect(result.listed?.overdue).toBe(true);
			expect(result.after).toBeUndefined();
			expect(result.refused).toMatch(/no longer waiting/);
			expect(result.row.contactAttempts).toBe(2);
			expect(result.row.note).toBe('Moved to Hawassa');
		}
	);
});
