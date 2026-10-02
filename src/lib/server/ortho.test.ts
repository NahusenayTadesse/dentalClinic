import { describe, expect, it } from 'vitest';
import { and, eq, isNull } from 'drizzle-orm';

import { db } from './db';
import { invoice, orthoInstalment, patient, user } from './db/schema';
import { inRollback } from '$lib/testing/rollback';
import { WriteRefused } from './childCrud';
import { addClinicMonths, clinicToday } from '$lib/clinicTime';
import {
	billDueInstalments,
	openCase,
	recordOrthoVisit,
	setOrthoStatus,
	type NewCase
} from './ortho';

/**
 * The plan's rules: instalments written when the case opens, billed only once due and only once,
 * each as an issued bill for its own amount; a discontinued case cancels what is not yet billed;
 * a closed case takes no visits. Built inside rollbacks; a patient and a user are borrowed.
 */
describe('orthodontic cases', async () => {
	const [someone] = await db.select({ id: patient.id }).from(patient).limit(1);
	const [clerk] = await db.select({ id: user.id }).from(user).limit(1);
	const ready = Boolean(someone && clerk);

	const event = {
		locals: { user: clerk ? { id: clerk.id } : null, branch: { active: null } },
		getClientAddress: () => '127.0.0.1'
	};

	// Started three months ago and a day: the deposit and three instalments are due.
	const plan: NewCase = {
		providerId: null,
		appliance: 'fixedBoth',
		startedOn: addClinicMonths(clinicToday(), -3),
		plannedMonths: 18,
		totalFee: 54000,
		deposit: 18000,
		instalments: 18,
		notes: null
	};

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
		'bills what is due once, as issued bills, and cancels the rest on discontinuing',
		async () => {
			const result = await inRollback(async (tx) => {
				const caseId = await openCase(tx, event, someone.id, plan);
				const billed = await billDueInstalments(tx, event, someone.id, caseId);
				const again = await refused(billDueInstalments(tx, event, someone.id, caseId));
				const rows = await tx
					.select({
						n: orthoInstalment.n,
						amount: orthoInstalment.amount,
						total: invoice.total,
						status: invoice.status
					})
					.from(orthoInstalment)
					.leftJoin(invoice, eq(invoice.id, orthoInstalment.invoiceId))
					.where(eq(orthoInstalment.caseId, caseId));

				await recordOrthoVisit(tx, event, someone.id, caseId, {
					visitedOn: clinicToday(),
					work: 'Upper 0.016 NiTi',
					nextInWeeks: 4,
					note: null,
					providerId: null,
					appointmentId: null
				});
				const backwards = await refused(setOrthoStatus(tx, event, someone.id, caseId, 'active'));
				await setOrthoStatus(tx, event, someone.id, caseId, 'discontinued');
				const left = await tx
					.select({ n: orthoInstalment.n })
					.from(orthoInstalment)
					.where(and(eq(orthoInstalment.caseId, caseId), isNull(orthoInstalment.deletedAt)));
				const closedVisit = await refused(
					recordOrthoVisit(tx, event, someone.id, caseId, {
						visitedOn: clinicToday(),
						work: 'x',
						nextInWeeks: null,
						note: null,
						providerId: null,
						appointmentId: null
					})
				);
				return { billed, again, rows, backwards, left: left.length, closedVisit };
			});

			expect(result.rows).toHaveLength(19);
			expect(result.billed).toBe(4);
			const billedRows = result.rows.filter((r) => r.status !== null);
			expect(billedRows.map((r) => r.n).sort()).toEqual([0, 1, 2, 3]);
			expect(billedRows.every((r) => r.status === 'issued' && r.total === r.amount)).toBe(true);
			expect(result.again).toMatch(/Nothing is due/);
			expect(result.backwards).toMatch(/cannot move/);
			// Discontinued: the four billed stay, the fifteen unbilled are cancelled.
			expect(result.left).toBe(4);
			expect(result.closedVisit).toMatch(/closed/);
		}
	);

	it.skipIf(!ready)('refuses a plan that does not add up', async () => {
		const message = await inRollback((tx) =>
			refused(openCase(tx, event, someone.id, { ...plan, deposit: 60000 }))
		);
		expect(message).toMatch(/deposit/);
	});
});
