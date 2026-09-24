/**
 * Patients and the clinical facts attached to them — allergies, conditions, medicines, contacts.
 *
 * Moved out of `seed-dev.ts` when the seed outgrew one file (CLAUDE.md §6). The reasoning about
 * determinism and about not using `drizzle-seed` near lookup tables is in `util.ts`.
 */
import { count, eq } from 'drizzle-orm';

import { patient, referralSource } from '../../src/lib/server/db/schema/patients';
import { customers } from '../../src/lib/server/db/schema/customers';
import { allergen, patientAllergies } from '../../src/lib/server/db/schema/allergies';
import { condition, patientConditions } from '../../src/lib/server/db/schema/conditions';
import { patientMedications } from '../../src/lib/server/db/schema/medications';
import { medicine } from '../../src/lib/server/db/schema/prescriptions';
import {
	contactTypes,
	patientContacts,
	patientEmergencyContacts
} from '../../src/lib/server/db/schema/contacts';
import { rng, type SeedDb } from './util';

/* ── Patients ─────────────────────────────────────────────────────────────────────────────────
 *
 * Written with plain inserts and a seeded random generator rather than drizzle-seed, because the
 * interesting part is not the patient row but its children — allergies, conditions, medicines —
 * and those must point at the real lookup rows `/setup` seeded, in proportions that make every
 * column filter and chart on the list show something. drizzle-seed's `reset` is also exactly the
 * wrong tool near `allergen` and `condition` (see the header).
 *
 * Same determinism every run, so a count noticed on screen today is the same count tomorrow.
 */

const GIVEN = [
	'Alex',
	'Sam',
	'Jordan',
	'Robin',
	'Casey',
	'Morgan',
	'Taylor',
	'Jamie',
	'Riley',
	'Quinn'
];
const FAMILY = ['Seedwell', 'Testa', 'Fixture', 'Sample', 'Demo', 'Mockley', 'Stubbs', 'Probe'];

export async function seedPatients(db: SeedDb, branches: string[]) {
	if (process.argv.includes('--fresh')) {
		// Children first: they hold foreign keys to the patient.
		for (const table of [
			patientAllergies,
			patientConditions,
			patientMedications,
			patientContacts,
			patientEmergencyContacts
		]) {
			await db.delete(table);
		}
		await db.delete(patient);
		console.log('Cleared patients and their clinical rows.');
	}

	const [{ existing }] = await db.select({ existing: count() }).from(patient);
	if (existing > 0) {
		console.log(`patient already holds ${existing} rows; skipping (use --fresh to reseed).`);
		return;
	}

	const [allergens, conditions, medicines, kinds, referrals] = await Promise.all([
		db.select({ id: allergen.id }).from(allergen),
		db.select({ id: condition.id }).from(condition),
		db.select({ id: medicine.id, name: medicine.genericName }).from(medicine),
		db.select({ id: contactTypes.id }).from(contactTypes),
		db.select({ id: referralSource.id }).from(referralSource)
	]);

	if (!allergens.length || !conditions.length) {
		console.log('No allergens or conditions — run /setup first. Skipping patients.');
		return;
	}

	// Two billing customers, so "who pays" has more than one answer.
	await db
		.insert(customers)
		.ignore()
		.values([
			{
				id: 901,
				name: 'Seed Insurance Co',
				phone: '0110000901',
				email: 'seed901@example.test',
				tinNo: 'SEED-901',
				approvalStatus: 'approved'
			},
			{
				id: 902,
				name: 'Seed Employer PLC',
				phone: '0110000902',
				email: 'seed902@example.test',
				tinNo: 'SEED-902',
				approvalStatus: 'approved'
			}
		]);
	await db.update(customers).set({ approvalStatus: 'approved' }).where(eq(customers.id, 901));

	const random = rng(20260913);
	const pick = <T>(items: readonly T[]) => items[Math.floor(random() * items.length)];
	const chance = (p: number) => random() < p;
	const rowCount = Number(process.env.SEED_PATIENTS ?? 400);
	const branchIds = [1, ...branches.map((_, i) => 901 + i)];
	const now = Date.now();

	for (let i = 1; i <= rowCount; i++) {
		const birthYear = 2026 - Math.floor(random() * 85);
		const knowsDate = chance(0.7);
		const registered = new Date(now - Math.floor(random() * 3 * 365) * 86_400_000);
		const historyAge = random();

		const [{ id }] = await db
			.insert(patient)
			.values({
				fileNo: `S-${String(i).padStart(5, '0')}`,
				name: pick(GIVEN),
				fatherName: pick(FAMILY),
				grandFatherName: chance(0.6) ? pick(FAMILY) : null,
				sex: chance(0.52) ? 'female' : 'male',
				birthDate: chance(0.92)
					? new Date(
							`${birthYear}-${knowsDate ? String(1 + Math.floor(random() * 12)).padStart(2, '0') : '01'}-${knowsDate ? String(1 + Math.floor(random() * 28)).padStart(2, '0') : '01'}`
						)
					: null,
				birthDateEstimated: !knowsDate,
				// Phones in the 0900-555 range: well-formed, and not anybody's number.
				phone: chance(0.9) ? `0900555${String(i).padStart(3, '0')}` : null,
				bloodType: chance(0.6)
					? pick(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const)
					: null,
				// A third never asked, a quarter stale, the rest current.
				historyTakenAt:
					historyAge < 0.33
						? null
						: new Date(
								now -
									Math.floor(
										(historyAge < 0.58 ? 400 + random() * 800 : random() * 300) * 86_400_000
									)
							),
				referralSourceId: referrals.length && chance(0.7) ? pick(referrals).id : null,
				customerId: chance(0.2) ? pick([901, 902]) : null,
				branchId: pick(branchIds),
				createdAt: registered
			})
			.$returningId();

		const allergyCount = chance(0.35) ? 1 + Math.floor(random() * 3) : 0;
		const chosenAllergens = new Set<number>();
		while (chosenAllergens.size < Math.min(allergyCount, allergens.length))
			chosenAllergens.add(pick(allergens).id);
		if (chosenAllergens.size) {
			await db.insert(patientAllergies).values(
				[...chosenAllergens].map((allergenId) => ({
					patientId: id,
					allergenId,
					severity: pick(['unknown', 'mild', 'moderate', 'severe'] as const)
				}))
			);
		}

		const chosenConditions = new Set<number>();
		const conditionCount = chance(0.4) ? 1 + Math.floor(random() * 2) : 0;
		while (chosenConditions.size < Math.min(conditionCount, conditions.length))
			chosenConditions.add(pick(conditions).id);
		if (chosenConditions.size) {
			await db.insert(patientConditions).values(
				[...chosenConditions].map((conditionId) => ({
					patientId: id,
					conditionId,
					status: pick(['active', 'active', 'suspected', 'inRemission', 'resolved'] as const)
				}))
			);
		}

		if (medicines.length && chance(0.3)) {
			const med = pick(medicines);
			await db.insert(patientMedications).values({
				patientId: id,
				medicineId: med.id,
				nameAsReported: med.name,
				status: chance(0.8) ? 'active' : 'stopped'
			});
		}

		if (kinds.length && chance(0.4)) {
			await db.insert(patientContacts).values({
				patientId: id,
				contactTypeId: pick(kinds).id,
				value: `seed${i}@example.test`
			});
		}

		if (chance(0.5)) {
			await db.insert(patientEmergencyContacts).values({
				patientId: id,
				name: `${pick(GIVEN)} ${pick(FAMILY)}`,
				relation: pick(['Mother', 'Father', 'Spouse', 'Sibling']),
				phone: `0900666${String(i).padStart(3, '0')}`,
				isPrimary: true
			});
		}
	}

	console.log(`Seeded ${rowCount} patients with allergies, conditions, medicines and contacts.`);
}
