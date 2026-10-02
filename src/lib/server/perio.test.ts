import { describe, expect, it } from 'vitest';
import { and, eq, isNull, notExists } from 'drizzle-orm';

import { db } from './db';
import { auditLog, perioExam, patient, user } from './db/schema';
import { inRollback } from '$lib/testing/rollback';
import { WriteRefused } from './childCrud';
import { PERIO_TEETH, emptyTooth } from '$lib/perio';
import { discardExam, finishExam, saveReadings, startExam } from './perio';

/**
 * The record's rules: one draft a patient, a finished exam fixed for good, a save that writes only
 * what changed and audits once, and the next exam compared with the last finished one. Built inside
 * rollbacks; a patient with no open exam and a user are borrowed.
 */
describe('periodontal exams', async () => {
	const [someone] = await db
		.select({ id: patient.id })
		.from(patient)
		.where(
			notExists(
				db
					.select({ id: perioExam.id })
					.from(perioExam)
					.where(and(eq(perioExam.patientId, patient.id), isNull(perioExam.completedAt)))
			)
		)
		.limit(1);
	const [clinician] = await db.select({ id: user.id }).from(user).limit(1);
	const ready = Boolean(someone && clinician);

	const event = {
		locals: { user: clinician ? { id: clinician.id } : null, branch: { active: null } },
		getClientAddress: () => '127.0.0.1'
	};
	const none = { providerId: null, appointmentId: null };

	const refused = async (write: Promise<unknown>) => {
		try {
			await write;
		} catch (err) {
			if (err instanceof WriteRefused) return err.message;
			throw err;
		}
		return null;
	};

	it.skipIf(!ready)('keeps one draft a patient, and a finished exam fixed', async () => {
		const result = await inRollback(async (tx) => {
			const id = await startExam(tx, event, someone.id, none);
			const second = await refused(startExam(tx, event, someone.id, none));
			const emptyFinish = await refused(finishExam(tx, event, someone.id, id));

			const readings = PERIO_TEETH.map((code) => emptyTooth(code));
			readings[0].sites.DB.depth = 5;
			readings[0].sites.DB.bleeding = true;
			readings[1].mobility = 2;
			const changed = await saveReadings(tx, event, someone.id, id, {
				teeth: readings,
				notes: 'Smoker'
			});
			const again = await saveReadings(tx, event, someone.id, id, {
				teeth: readings,
				notes: 'Smoker'
			});
			const audits = await tx
				.select({ changes: auditLog.changes })
				.from(auditLog)
				.where(and(eq(auditLog.tableName, 'perio_exam'), eq(auditLog.recordId, String(id))));

			await finishExam(tx, event, someone.id, id);
			const afterFinish = await refused(
				saveReadings(tx, event, someone.id, id, { teeth: readings, notes: '' })
			);
			const discardFinished = await refused(discardExam(tx, event, someone.id, id));
			const next = await startExam(tx, event, someone.id, none);
			await discardExam(tx, event, someone.id, next);
			const [gone] = await tx
				.select({ deletedAt: perioExam.deletedAt })
				.from(perioExam)
				.where(eq(perioExam.id, next));

			return {
				second,
				emptyFinish,
				changed,
				again,
				audits: audits.length,
				afterFinish,
				discardFinished,
				discarded: gone?.deletedAt !== null
			};
		});

		expect(result.second).toMatch(/already has an exam/);
		expect(result.emptyFinish).toMatch(/Nothing has been measured/);
		// One site (depth and bleeding together) and one tooth.
		expect(result.changed).toBe(2);
		expect(result.again).toBe(0);
		// The create, and the one save that changed something: a save of nothing is not an event.
		expect(result.audits).toBe(2);
		expect(result.afterFinish).toMatch(/finished/);
		expect(result.discardFinished).toMatch(/finished/);
		expect(result.discarded).toBe(true);
	});

	it.skipIf(!ready)('refuses a reading no probe can give', async () => {
		const message = await inRollback(async (tx) => {
			const id = await startExam(tx, event, someone.id, none);
			const teeth = PERIO_TEETH.map((code) => emptyTooth(code));
			teeth[0].sites.B.depth = 22;
			return refused(saveReadings(tx, event, someone.id, id, { teeth, notes: '' }));
		});
		expect(message).toMatch(/0 to 15/);
	});
});
