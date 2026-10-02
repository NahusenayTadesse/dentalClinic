/**
 * The sterilisation log: an autoclave at each branch and three weeks of cycles — a morning test and
 * two loads a day, a spore test in one load a week, packs labelled and most of them used on the
 * patients seen. One spore test, a fortnight ago, grew: so the log has a failed cycle whose page
 * lists patients to call, which is the screen worth seeing.
 */
import { and, eq, isNull } from 'drizzle-orm';

import { appointment } from '../../src/lib/server/db/schema/scheduling';
import { branch } from '../../src/lib/server/db/schema/branches';
import {
	instrumentPack,
	packUse,
	steriliser,
	sterilisationCycle
} from '../../src/lib/server/db/schema/sterilisation';
import { cycleStatus, packCode, type IndicatorResult } from '../../src/lib/sterilisation';
import { dateAt, isEmpty, localDate, randomness, type SeedDb } from './util';

export async function seedSterilisation(db: SeedDb) {
	if (!(await isEmpty(db, steriliser, 'steriliser'))) return;

	const branches = await db.select({ id: branch.id }).from(branch).where(isNull(branch.deletedAt));
	const { pick, chance, between } = randomness(20261007);
	let cycles = 0;
	let used = 0;

	for (const [b, place] of branches.entries()) {
		const [{ id: machine }] = await db
			.insert(steriliser)
			.values({
				name: `Autoclave ${b + 1}`,
				kind: 'autoclaveB',
				serialNo: `SEED-${place.id}`,
				branchId: place.id
			})
			.$returningId();

		// Who was seen at this branch lately, to open packs for.
		const visits = await db
			.select({ id: appointment.id, patientId: appointment.patientId })
			.from(appointment)
			.where(and(eq(appointment.branchId, place.id), isNull(appointment.deletedAt)))
			.limit(400);

		let n = 0;
		for (let daysAgo = 21; daysAgo >= 1; daysAgo--) {
			for (const [kind, hour] of [
				['bowieDick', 7],
				['load', 10],
				['load', 15]
			] as const) {
				n++;
				const ranAt = dateAt(-daysAgo);
				ranAt.setUTCHours(hour - 3, between(0, 50), 0, 0);
				const spore: IndicatorResult =
					kind === 'load' && hour === 10 && daysAgo % 7 === 0
						? daysAgo === 14 && b === 0
							? 'fail'
							: 'pass'
						: 'none';
				const [{ id: cycleId }] = await db
					.insert(sterilisationCycle)
					.values({
						steriliserId: machine,
						branchId: place.id,
						cycleNo: n,
						kind,
						ranAt,
						program:
							kind === 'load'
								? '134 °C · 4 min'
								: kind === 'bowieDick'
									? 'B&D test'
									: 'Vacuum test',
						temperatureC: kind === 'load' ? 134 : null,
						holdMinutes: kind === 'load' ? 4 : null,
						chemicalIndicator: 'pass',
						biologicalIndicator: spore,
						biologicalReadAt: spore === 'none' ? null : dateAt(-daysAgo + 2),
						status: cycleStatus('pass', spore),
						note: spore === 'fail' ? 'Spore test grew. Engineer called; machine serviced.' : null
					})
					.$returningId();
				cycles++;
				if (kind !== 'load') continue;

				const contents = [
					...Array.from({ length: 6 }, () => 'Exam kit'),
					...Array.from({ length: 2 }, () => 'Extraction set')
				];
				const expiresOn = localDate(-daysAgo + 30);
				for (const [i, what] of contents.entries()) {
					const [{ id: packId }] = await db
						.insert(instrumentPack)
						.values({ cycleId, code: packCode(machine, n, i + 1), contents: what, expiresOn })
						.$returningId();
					if (!visits.length || !chance(0.7)) continue;
					const visit = pick(visits);
					await db.insert(packUse).values({
						packId,
						patientId: visit.patientId,
						appointmentId: visit.id,
						usedAt: dateAt(-daysAgo + (chance(0.5) ? 0 : 1))
					});
					used++;
				}
			}
		}
	}
	console.log(`sterilisation: ${cycles} cycles, ${used} packs used.`);
}
