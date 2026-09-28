import { describe, expect, it } from 'vitest';
import { and, eq, isNotNull } from 'drizzle-orm';

import { db } from './db';
import {
	patient,
	procedures,
	provider,
	services,
	treatmentPlan,
	treatmentPlanItem
} from './db/schema';
import { inRollback, type TestTx } from '$lib/testing/rollback';
import { WriteRefused } from './childCrud';
import {
	addLines,
	answerPlan,
	completePlan,
	createPlan,
	originalTotal,
	planAdjustments,
	plannableProcedures,
	presentPlan,
	removeLine,
	updateLine
} from './treatmentPlans';

/**
 * A plan is a record of what a patient was told and what they said, so the rules that matter are
 * the refusals: a quote cannot be edited once shown, a piece of work cannot be on two open plans,
 * an answer must cover every line and say why when it is no, and a plan is not finished until the
 * accepted work is. Built inside a rollback; a patient, a dentist and a priced service are borrowed.
 */
describe('treatment plans', async () => {
	const [someone] = await db.select({ id: patient.id }).from(patient).limit(1);
	const [dentist] = await db.select({ id: provider.id }).from(provider).limit(1);
	const [service] = await db
		.select({ id: services.id, name: services.name })
		.from(services)
		// A tooth-level service, so a line's description names the tooth.
		.where(and(isNotNull(services.price), eq(services.status, true), eq(services.area, 'tooth')))
		.limit(1);
	const ready = Boolean(someone && dentist && service);

	const request = {
		locals: { user: null, branch: { active: 1 } },
		getClientAddress: () => '127.0.0.1'
	};

	/** Two planned procedures on the borrowed patient, at 1,000 and 2,500 birr. */
	async function plannedWork(tx: TestTx) {
		const [a] = await tx
			.insert(procedures)
			.values({
				patientId: someone.id,
				serviceId: service.id,
				providerId: dentist.id,
				status: 'planned',
				toothId: 36,
				fee: 1000
			})
			.$returningId();
		const [b] = await tx
			.insert(procedures)
			.values({
				patientId: someone.id,
				serviceId: service.id,
				providerId: dentist.id,
				status: 'planned',
				toothId: 46,
				fee: 2500
			})
			.$returningId();
		return [a.id, b.id];
	}

	const refused = async (write: Promise<unknown>) => {
		try {
			await write;
		} catch (err) {
			if (err instanceof WriteRefused) return err.message;
			throw err;
		}
		return null;
	};

	it.skipIf(!ready)('snapshots each line, and holds the work against a second plan', async () => {
		const result = await inRollback(async (tx) => {
			const [a, b] = await plannedWork(tx);
			const planId = await createPlan(tx, request, {
				patientId: someone.id,
				procedureIds: [a],
				providerId: dentist.id,
				note: null,
				branchId: 1
			});

			// The snapshot does not follow the procedure once written.
			await tx.update(procedures).set({ fee: 9999 }).where(eq(procedures.id, a));
			const [line] = await tx
				.select()
				.from(treatmentPlanItem)
				.where(eq(treatmentPlanItem.treatmentPlanId, planId));

			const offered = (await plannableProcedures(someone.id, tx)).map((p) => p.id);
			const twice = await refused(
				createPlan(tx, request, {
					patientId: someone.id,
					procedureIds: [a],
					providerId: null,
					note: null,
					branchId: 1
				})
			);
			return { line, offered, twice, b };
		});

		expect(result.line.unitPrice).toBe(1000);
		expect(result.line.description).toContain('36');
		expect(result.offered).not.toContain(result.line.procedureId);
		expect(result.offered).toContain(result.b);
		expect(result.twice).toMatch(/already on another plan/);
	});

	it.skipIf(!ready)(
		'keeps every change to a presented quote, with its reason, and can read the first quote back',
		async () => {
			const result = await inRollback(async (tx) => {
				const [a, b] = await plannedWork(tx);
				const planId = await createPlan(tx, request, {
					patientId: someone.id,
					procedureIds: [a],
					providerId: null,
					note: null,
					branchId: 1
				});
				const [line] = await tx
					.select({ id: treatmentPlanItem.id })
					.from(treatmentPlanItem)
					.where(eq(treatmentPlanItem.treatmentPlanId, planId));

				// A draft changes freely and leaves no history: nobody has seen it.
				await updateLine(tx, request, someone.id, planId, {
					itemId: line.id,
					description: 'Filling, lower left molar',
					quantity: 1,
					unitPrice: 900
				});
				await presentPlan(tx, request, someone.id, planId, null);
				const draftHistory = await planAdjustments(planId, tx);

				// Presented: a change needs a reason, and writes a row.
				const noReason = await refused(
					updateLine(tx, request, someone.id, planId, {
						itemId: line.id,
						description: 'Filling, lower left molar',
						quantity: 1,
						unitPrice: 850
					})
				);
				await updateLine(tx, request, someone.id, planId, {
					itemId: line.id,
					description: 'Filling, lower left molar',
					quantity: 1,
					unitPrice: 850,
					reason: 'Discount agreed in the chair'
				});
				await addLines(tx, request, someone.id, planId, [b], 'X-ray showed a second tooth');

				const [after] = await tx
					.select()
					.from(treatmentPlanItem)
					.where(eq(treatmentPlanItem.id, line.id));
				const history = await planAdjustments(planId, tx);
				return { draftHistory, noReason, after, history };
			});

			expect(result.draftHistory).toHaveLength(0);
			expect(result.noReason).toMatch(/Say why/);
			expect(result.after.lineTotal).toBe(850);
			expect(result.history.map((h) => h.kind)).toEqual(['changed', 'added']);
			expect(result.history[0].changes.unitPrice).toEqual([900, 850]);
			expect(result.history[0].reason).toBe('Discount agreed in the chair');
			// First quoted: 900, before the discount and the added 2,500 line.
			expect(originalTotal(850 + 2500, result.history)).toBe(900);
		}
	);

	it.skipIf(!ready)(
		'after an answer: refuses new lines, and re-reads the plan from the lines left when one goes',
		async () => {
			const result = await inRollback(async (tx) => {
				const [a, b] = await plannedWork(tx);
				const planId = await createPlan(tx, request, {
					patientId: someone.id,
					procedureIds: [a, b],
					providerId: null,
					note: null,
					branchId: 1
				});
				await presentPlan(tx, request, someone.id, planId, null);
				const lines = await tx
					.select({ id: treatmentPlanItem.id, procedureId: treatmentPlanItem.procedureId })
					.from(treatmentPlanItem)
					.where(eq(treatmentPlanItem.treatmentPlanId, planId));
				const yes = lines.find((l) => l.procedureId === a)!.id;
				const no = lines.find((l) => l.procedureId === b)!.id;
				await answerPlan(tx, request, someone.id, planId, {
					decisions: { [yes]: 'accepted', [no]: 'declined' },
					reason: 'Only the painful tooth for now'
				});

				const [c] = await plannedWork(tx);
				const addAfter = await refused(addLines(tx, request, someone.id, planId, [c], 'More'));

				// Taking off the only "no" leaves every line a yes: the plan is now accepted.
				await removeLine(tx, request, someone.id, planId, no, 'Done at another clinic');
				const [plan] = await tx.select().from(treatmentPlan).where(eq(treatmentPlan.id, planId));
				const lastLine = await refused(
					removeLine(tx, request, someone.id, planId, yes, 'Changed mind')
				);
				const history = await planAdjustments(planId, tx);
				return { addAfter, plan, lastLine, history };
			});

			expect(result.addAfter).toMatch(/already answered/);
			expect(result.plan.status).toBe('accepted');
			expect(result.lastLine).toMatch(/last line/);
			expect(result.history).toHaveLength(1);
			expect(result.history[0]).toMatchObject({ kind: 'removed', afterAnswer: true });
			// The removed line is still named: its row is soft-deleted, not gone.
			expect(result.history[0].line).toContain('46');
		}
	);

	it.skipIf(!ready)(
		'takes an answer for every line, wants a reason for a no, and finishes when the work is done',
		async () => {
			const result = await inRollback(async (tx) => {
				const [a, b] = await plannedWork(tx);
				const planId = await createPlan(tx, request, {
					patientId: someone.id,
					procedureIds: [a, b],
					providerId: null,
					note: null,
					branchId: 1
				});
				await presentPlan(tx, request, someone.id, planId, null);
				const lines = await tx
					.select({ id: treatmentPlanItem.id, procedureId: treatmentPlanItem.procedureId })
					.from(treatmentPlanItem)
					.where(eq(treatmentPlanItem.treatmentPlanId, planId));
				const lineOf = (procedureId: number) =>
					lines.find((l) => l.procedureId === procedureId)!.id;

				const halfAnswered = await refused(
					answerPlan(tx, request, someone.id, planId, {
						decisions: { [lineOf(a)]: 'accepted' },
						reason: null
					})
				);
				const noReason = await refused(
					answerPlan(tx, request, someone.id, planId, {
						decisions: { [lineOf(a)]: 'accepted', [lineOf(b)]: 'declined' },
						reason: ''
					})
				);
				await answerPlan(tx, request, someone.id, planId, {
					decisions: { [lineOf(a)]: 'accepted', [lineOf(b)]: 'declined' },
					reason: 'Will come back after the harvest'
				});
				const [answered] = await tx
					.select()
					.from(treatmentPlan)
					.where(eq(treatmentPlan.id, planId));

				const tooSoon = await refused(completePlan(tx, request, someone.id, planId));
				await tx
					.update(procedures)
					.set({ status: 'completed', completedOn: '2026-09-27' })
					.where(eq(procedures.id, a));
				await completePlan(tx, request, someone.id, planId);
				const [done] = await tx.select().from(treatmentPlan).where(eq(treatmentPlan.id, planId));

				// The declined work is free to be quoted again; the accepted work is done.
				const offered = (await plannableProcedures(someone.id, tx)).map((p) => p.id);
				return { halfAnswered, noReason, answered, tooSoon, done, offered, b };
			});

			expect(result.halfAnswered).toMatch(/every line/);
			expect(result.noReason).toMatch(/Say why/);
			expect(result.answered.status).toBe('partial');
			expect(result.answered.declineReason).toBe('Will come back after the harvest');
			expect(result.tooSoon).toMatch(/Not all the accepted work/);
			expect(result.done.status).toBe('completed');
			expect(result.offered).toContain(result.b);
		}
	);

	it.skipIf(!ready)('refuses an answer to a quote that has expired', async () => {
		const message = await inRollback(async (tx) => {
			const [a] = await plannedWork(tx);
			const planId = await createPlan(tx, request, {
				patientId: someone.id,
				procedureIds: [a],
				providerId: null,
				note: null,
				branchId: 1
			});
			await presentPlan(tx, request, someone.id, planId, null);
			await tx
				.update(treatmentPlan)
				.set({ validUntil: '2020-01-01' })
				.where(eq(treatmentPlan.id, planId));
			const [line] = await tx
				.select({ id: treatmentPlanItem.id })
				.from(treatmentPlanItem)
				.where(eq(treatmentPlanItem.treatmentPlanId, planId));
			return refused(
				answerPlan(tx, request, someone.id, planId, {
					decisions: { [line.id]: 'accepted' },
					reason: null
				})
			);
		});
		expect(message).toMatch(/expired/);
	});

	it.skipIf(!ready)('refuses a plan of another patient’s', async () => {
		const message = await inRollback(async (tx) => {
			const [a] = await plannedWork(tx);
			const planId = await createPlan(tx, request, {
				patientId: someone.id,
				procedureIds: [a],
				providerId: null,
				note: null,
				branchId: 1
			});
			return refused(presentPlan(tx, request, someone.id + 100000, planId, null));
		});
		expect(message).toMatch(/not on this patient/);
	});
});
