/**
 * Treatment plans over the planned work the clinical seed charted — in every state a clinic has
 * them in, so the plans tab, the follow-up list and case acceptance all have something to show.
 *
 * Written directly rather than through `server/treatmentPlans.ts`: a seed has no request to audit
 * against, and the module's refusals are what its own tests exercise. The rows still keep its
 * rules — each line snapshots its procedure's description and price, a piece of work is on one
 * open plan at most, and a plan's status agrees with its lines.
 */
import { and, eq, isNull } from 'drizzle-orm';

import { patient } from '../../src/lib/server/db/schema/patients';
import { procedures } from '../../src/lib/server/db/schema/procedures';
import { services } from '../../src/lib/server/db/schema/services';
import { treatmentPlan, treatmentPlanItem } from '../../src/lib/server/db/schema/treatmentPlans';
import { whereLabel } from '../../src/lib/teeth';
import { isEmpty, localDate, randomness, type SeedDb } from './util';

/** Why a patient said no — the prose a clinic follows up on. */
const REASONS = [
	'Will come back after the harvest',
	'Wants a second opinion',
	'Cannot afford it this month',
	'Only wants the painful tooth treated for now',
	'Travelling; will book on return'
];

export async function seedTreatmentPlans(db: SeedDb) {
	if (!(await isEmpty(db, treatmentPlan, 'treatment_plan'))) return;

	const planned = await db
		.select({
			id: procedures.id,
			patientId: procedures.patientId,
			providerId: procedures.providerId,
			branchId: patient.branchId,
			service: services.name,
			area: services.area,
			toothId: procedures.toothId,
			surfaces: procedures.surfaces,
			toothRange: procedures.toothRange,
			fee: procedures.fee,
			price: services.price
		})
		.from(procedures)
		.innerJoin(patient, eq(patient.id, procedures.patientId))
		.innerJoin(services, eq(services.id, procedures.serviceId))
		.where(and(eq(procedures.status, 'planned'), isNull(procedures.deletedAt)));
	if (!planned.length) return;

	const byPatient = new Map<number, typeof planned>();
	for (const work of planned) {
		byPatient.set(work.patientId, [...(byPatient.get(work.patientId) ?? []), work]);
	}

	const { pick, between } = randomness(20261005);
	let made = 0;

	for (const [patientId, work] of [...byPatient].slice(0, 60)) {
		const roll = between(1, 100);
		const drawn =
			roll <= 30
				? 'presented'
				: roll <= 50
					? 'accepted'
					: roll <= 68
						? 'partial'
						: roll <= 83
							? 'declined'
							: roll <= 93
								? 'expired'
								: 'draft';
		// A one-line plan cannot be partly accepted: its answer would be all yes.
		const status = drawn === 'partial' && work.length < 2 ? 'accepted' : drawn;

		// Expired is derived from the date, never stored: a presented plan whose date has passed.
		const presentedAgo = status === 'expired' ? between(100, 200) : between(2, 60);
		const presentedOn = status === 'draft' ? null : localDate(-presentedAgo);
		const validUntil =
			status === 'draft' ? null : localDate(-presentedAgo + (status === 'expired' ? 90 : 120));
		const decided = ['accepted', 'partial', 'declined'].includes(status);

		const [{ id: planId }] = await db
			.insert(treatmentPlan)
			.values({
				patientId,
				providerId: work[0].providerId,
				branchId: work[0].branchId ?? undefined,
				status: status === 'expired' ? 'presented' : status,
				presentedOn,
				validUntil,
				decidedOn: decided ? localDate(-presentedAgo + between(1, 7)) : null,
				declineReason: status === 'partial' || status === 'declined' ? pick(REASONS) : null
			})
			.$returningId();

		for (const [index, item] of work.entries()) {
			const price = item.fee ?? item.price ?? 0;
			const where = whereLabel(item);
			const decision =
				status === 'accepted'
					? 'accepted'
					: status === 'declined'
						? 'declined'
						: status === 'partial'
							? // The first line yes and the rest no, so a partial plan is partial.
								index === 0
								? 'accepted'
								: 'declined'
							: 'pending';
			await db.insert(treatmentPlanItem).values({
				treatmentPlanId: planId,
				procedureId: item.id,
				description: where === 'Whole mouth' ? item.service : `${item.service} — ${where}`,
				toothId: item.toothId,
				quantity: 1,
				unitPrice: price,
				lineTotal: price,
				decision,
				sortOrder: index + 1
			});
		}
		made++;
	}

	console.log(`Seeded ${made} treatment plans.`);
}
