/**
 * Periodontal exams: two finished charts, months apart, for some adult patients — so the Gums tab
 * has a history to compare and the "since the last exam" figures are not always "no earlier exam".
 *
 * Most mouths are healthy (2–3 mm, a little bleeding); about a third have periodontitis around the
 * molars, which the second exam either brings under control or lets worsen. Teeth the chart
 * shows as extracted are charted missing, as `startExam` would have marked them.
 */
import { and, eq, inArray, isNull, lt } from 'drizzle-orm';

import { patient } from '../../src/lib/server/db/schema/patients';
import { procedures } from '../../src/lib/server/db/schema/procedures';
import { provider } from '../../src/lib/server/db/schema/providers';
import { services } from '../../src/lib/server/db/schema/services';
import { perioExam, perioSite, perioTooth } from '../../src/lib/server/db/schema/perio';
import { PERIO_SITES, PERIO_TEETH } from '../../src/lib/perio';
import { toothType } from '../../src/lib/teeth';
import { dateAt, isEmpty, localDate, randomness, type SeedDb } from './util';

export async function seedPerio(db: SeedDb) {
	if (!(await isEmpty(db, perioExam, 'perio_exam'))) return;

	const adults = await db
		.select({ id: patient.id, branchId: patient.branchId })
		.from(patient)
		.where(
			and(
				isNull(patient.deletedAt),
				isNull(patient.mergedIntoId),
				// Over thirty: old enough for gum disease to be the question.
				lt(patient.birthDate, dateAt(-30 * 365))
			)
		)
		.limit(400);
	const clinicians = await db
		.select({ id: provider.id })
		.from(provider)
		.where(isNull(provider.deletedAt));
	if (!adults.length || !clinicians.length) return;

	const { pick, chance, between } = randomness(20261003);
	const chosen = adults.filter(() => chance(0.08)).slice(0, 30);

	const gone = await db
		.select({ patientId: procedures.patientId, toothId: procedures.toothId })
		.from(procedures)
		.innerJoin(services, eq(services.id, procedures.serviceId))
		.where(
			and(
				eq(services.removesTooth, true),
				inArray(procedures.status, ['completed', 'existing']),
				isNull(procedures.deletedAt),
				inArray(
					procedures.patientId,
					chosen.map((p) => p.id)
				)
			)
		);

	for (const person of chosen) {
		const missing = new Set(
			gone.filter((g) => g.patientId === person.id && g.toothId).map((g) => g.toothId)
		);
		const diseased = chance(0.35);
		const improves = chance(0.5);
		const providerId = pick(clinicians).id;
		// Each site's pocket at the first visit, so the second moves from it rather than re-rolling.
		const baseline = new Map(
			PERIO_TEETH.flatMap((toothId) =>
				PERIO_SITES.map((site) => {
					const back = toothType(toothId) === 'molar';
					return [`${toothId}${site}`, diseased && back ? between(4, 6) : between(1, 3)] as const;
				})
			)
		);

		for (const [examinedDaysAgo, visit] of [
			[between(170, 220), 0],
			[between(5, 40), 1]
		] as const) {
			const [{ id: examId }] = await db
				.insert(perioExam)
				.values({
					patientId: person.id,
					providerId,
					branchId: person.branchId,
					examinedOn: localDate(-examinedDaysAgo),
					completedAt: dateAt(-examinedDaysAgo),
					notes: diseased && visit === 0 ? 'Scaling and root planing advised.' : null
				})
				.$returningId();

			await db.insert(perioTooth).values(
				PERIO_TEETH.map((toothId) => ({
					examId,
					toothId,
					missing: missing.has(toothId),
					mobility: diseased && toothType(toothId) === 'molar' ? between(0, 2) : 0,
					furcation:
						diseased && toothType(toothId) === 'molar' && chance(0.4) ? between(1, 2) : null
				}))
			);

			// Deeper at the back in disease; at the second visit those molars get better or worse by
			// up to 2 mm, and every other site stays where it was.
			await db.insert(perioSite).values(
				PERIO_TEETH.flatMap((toothId) =>
					PERIO_SITES.map((site) => {
						if (missing.has(toothId)) return { examId, toothId, site };
						const back = toothType(toothId) === 'molar';
						const base = baseline.get(`${toothId}${site}`) ?? 2;
						const moved = visit === 1 && diseased && back ? between(0, 2) : 0;
						const depth = Math.max(1, base + (improves ? -moved : moved));
						return {
							examId,
							toothId,
							site,
							depth,
							recession: diseased && back && chance(0.3) ? between(1, 2) : 0,
							bleeding: chance(depth >= 4 ? 0.6 : 0.08),
							plaque: chance(diseased ? 0.45 : 0.15)
						};
					})
				)
			);
		}
	}
	console.log(`perio_exam: ${chosen.length * 2} exams for ${chosen.length} patients.`);
}
