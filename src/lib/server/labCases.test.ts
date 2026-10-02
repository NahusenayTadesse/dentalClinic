import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';

import { db } from './db';
import { dentalLab, labCase, patient, services } from './db/schema';
import { inRollback } from '$lib/testing/rollback';
import { WriteRefused } from './childCrud';
import {
	labPerformance,
	moveLabCase,
	openLabCase,
	patientLabCases,
	type LabCaseInput
} from './labCases';
import { addClinicDays, clinicToday } from '$lib/clinicTime';

/**
 * Lab work is dates: each move sets its own, the lab's turnaround fills the promise, a remake goes
 * round again and is counted, and a finished case does not move. Built inside rollbacks; a patient,
 * a laboratory and a service are borrowed.
 */
describe('lab cases', async () => {
	const [someone] = await db.select({ id: patient.id }).from(patient).limit(1);
	const [lab] = await db.select({ id: dentalLab.id }).from(dentalLab).limit(1);
	const [crown] = await db.select({ id: services.id }).from(services).limit(1);
	const ready = Boolean(someone && lab && crown);
	const request = {
		locals: { user: null, branch: { active: null } },
		getClientAddress: () => '127.0.0.1'
	};
	const docket = (change: Partial<LabCaseInput> = {}): LabCaseInput => ({
		labId: lab.id,
		procedureId: null,
		serviceId: crown.id,
		providerId: null,
		teeth: '14-16',
		shade: 'A2',
		labFee: 1800,
		instructions: 'PFM bridge',
		send: true,
		dueOn: null,
		...change
	});

	const refused = async (write: Promise<unknown>) => {
		try {
			await write;
		} catch (err) {
			if (err instanceof WriteRefused) return err.message;
			throw err;
		}
		return null;
	};

	it.skipIf(!ready)(
		'dates each move, fills the due date from the lab, and counts a remake',
		async () => {
			const today = clinicToday();
			const result = await inRollback(async (tx) => {
				await tx
					.update(dentalLab)
					.set({ typicalTurnaroundDays: 7 })
					.where(eq(dentalLab.id, lab.id));
				const id = await openLabCase(tx, request, someone.id, docket());
				const [sent] = await tx.select().from(labCase).where(eq(labCase.id, id));
				await moveLabCase(tx, request, someone.id, id, 'received');
				await moveLabCase(tx, request, someone.id, id, 'remake', {
					dueOn: addClinicDays(today, 3)
				});
				const [remade] = await tx.select().from(labCase).where(eq(labCase.id, id));
				await moveLabCase(tx, request, someone.id, id, 'received');
				await moveLabCase(tx, request, someone.id, id, 'fitted');
				const fittedAgain = await refused(moveLabCase(tx, request, someone.id, id, 'remake'));
				const [done] = await tx.select().from(labCase).where(eq(labCase.id, id));
				const listed = await patientLabCases(someone.id, tx);
				return { sent, remade, fittedAgain, done, listed, id };
			});
			expect(result.sent.status).toBe('sent');
			expect(result.sent.sentOn).toBe(today);
			expect(result.sent.dueOn).toBe(addClinicDays(today, 7));
			// Stored in the order the chart reads them: the upper right runs 18 down to 11.
			expect(result.sent.toothRange).toBe('16,15,14');
			expect(result.remade.status).toBe('remake');
			expect(result.remade.receivedOn).toBeNull();
			expect(result.remade.remakes).toBe(1);
			expect(result.done.status).toBe('fitted');
			expect(result.done.fittedOn).toBe(today);
			expect(result.fittedAgain).toMatch(/cannot be marked/);
			expect(result.listed.find((c) => c.id === result.id)?.remakes).toBe(1);
		}
	);

	it.skipIf(!ready)(
		'refuses a due date in the past, a bad span, and another patient’s case',
		async () => {
			const result = await inRollback(async (tx) => {
				const past = await refused(
					openLabCase(tx, request, someone.id, docket({ dueOn: '2020-01-01' }))
				);
				const badSpan = await refused(
					openLabCase(tx, request, someone.id, docket({ teeth: '14-24' }))
				);
				const id = await openLabCase(tx, request, someone.id, docket());
				const elsewhere = await refused(
					moveLabCase(tx, request, someone.id + 100000, id, 'received')
				);
				return { past, badSpan, elsewhere };
			});
			expect(result.past).toMatch(/in the past/);
			expect(result.badSpan).toMatch(/crosses quadrants/);
			expect(result.elsewhere).toMatch(/not on this patient/);
		}
	);

	it.skipIf(!ready)('measures a lab by what it delivered against what it promised', async () => {
		const stats = await inRollback(async (tx) => {
			await tx.insert(labCase).values({
				patientId: someone.id,
				labId: lab.id,
				status: 'fitted',
				sentOn: addClinicDays(clinicToday(), -20),
				dueOn: addClinicDays(clinicToday(), -13),
				receivedOn: addClinicDays(clinicToday(), -10),
				remakes: 1
			});
			return labPerformance({ active: null }, tx);
		});
		expect(stats.length).toBeGreaterThan(0);
		expect(stats.some((s) => s.late >= 1 && (s.averageLateDays ?? 0) >= 1)).toBe(true);
	});
});
