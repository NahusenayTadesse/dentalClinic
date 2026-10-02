/**
 * Orthodontic cases: a dozen teenagers and young adults in braces, started between two months and
 * a year and a half ago, with an adjustment visit about every five weeks and their payment plans.
 * Instalments are left unbilled, so the board's "Due to bill" list has work on it — billing them is
 * the screen worth trying.
 */
import { and, gte, isNull, lte } from 'drizzle-orm';

import { patient } from '../../src/lib/server/db/schema/patients';
import { provider } from '../../src/lib/server/db/schema/providers';
import { orthoCase, orthoInstalment, orthoVisit } from '../../src/lib/server/db/schema/ortho';
import { APPLIANCES, instalmentSchedule } from '../../src/lib/orthoPlan';
import { addClinicDays } from '../../src/lib/clinicTime';
import { isEmpty, localDate, randomness, type SeedDb } from './util';

const WORK = [
	'Bonded upper and lower, 0.014 NiTi',
	'Upper 0.016 NiTi, lower 0.016 NiTi',
	'Upper 0.018 SS, lower 0.016 NiTi',
	'Class II elastics, 3/16 medium',
	'Bracket rebonded on 22',
	'Power chain upper, space closure',
	'Upper 0.019×0.025 SS',
	'Detail bends; check midline'
];

export async function seedOrtho(db: SeedDb) {
	if (!(await isEmpty(db, orthoCase, 'ortho_case'))) return;

	const young = await db
		.select({ id: patient.id, branchId: patient.branchId })
		.from(patient)
		.where(
			and(
				isNull(patient.deletedAt),
				isNull(patient.mergedIntoId),
				gte(patient.birthDate, new Date(Date.now() - 26 * 365 * 86_400_000)),
				lte(patient.birthDate, new Date(Date.now() - 11 * 365 * 86_400_000))
			)
		)
		.limit(12);
	const clinicians = await db.select({ id: provider.id }).from(provider).limit(3);
	if (!young.length || !clinicians.length) return;

	const { pick, between } = randomness(20261009);
	for (const person of young) {
		const monthsIn = between(2, 18);
		const startedOn = localDate(-monthsIn * 30);
		const totalFee = pick([45000, 55000, 65000, 80000]);
		const deposit = Math.round(totalFee * 0.25);
		const instalments = pick([12, 18, 24]);
		const providerId = pick(clinicians).id;
		const [{ id: caseId }] = await db
			.insert(orthoCase)
			.values({
				patientId: person.id,
				providerId,
				branchId: person.branchId,
				appliance: pick(APPLIANCES.slice(0, 4)),
				startedOn,
				plannedMonths: pick([18, 24]),
				totalFee,
				deposit,
				instalments,
				notes: pick([
					'Class II div 1, crowding; non-extraction',
					'Class I crowding',
					'Deep bite, spacing'
				])
			})
			.$returningId();

		await db.insert(orthoInstalment).values(
			instalmentSchedule({ totalFee, deposit, count: instalments, startedOn }).map((i) => ({
				...i,
				caseId
			}))
		);

		const visits = [];
		for (let day = 0; day < monthsIn * 30 - 7; day += between(28, 42)) {
			visits.push({
				caseId,
				providerId,
				visitedOn: addClinicDays(startedOn, day),
				work: day === 0 ? WORK[0] : pick(WORK.slice(1)),
				nextInWeeks: pick([4, 5, 6])
			});
		}
		if (visits.length) await db.insert(orthoVisit).values(visits);
	}
	console.log(`ortho_case: ${young.length} cases.`);
}
