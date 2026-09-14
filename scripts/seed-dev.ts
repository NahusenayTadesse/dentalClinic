/**
 * Fills a development database with enough rows to see the app work.
 *
 * An empty database hides whole classes of problem. The table's facet counts and charts were
 * wrong for months partly because nobody had enough employees on screen to notice that the chart
 * disagreed with the list — with four rows and one department, every arrangement looks right.
 *
 * Run:  npm run db:seed
 *
 * **This deletes data.** `drizzle-seed`'s `reset` truncates the tables it is given, and it does
 * not care whether you put them there: pointed at `department` it emptied the departments a
 * hundred employees referenced, leaving every one of them with a dangling foreign key and a blank
 * column on screen. That is why the lookup tables below are written by hand and never reset, and
 * why this refuses to run anywhere that is not obviously a developer's own machine.
 *
 * Non-goal: demo data for a customer. This makes rows that exercise the UI, not rows anybody
 * should be shown — the names are `Staff 1..n` on purpose, so nothing here can be mistaken for a
 * real patient or employee if it ever escapes into a screenshot.
 */
import 'dotenv/config';
import mysql from 'mysql2/promise';
import { and, count, eq, gte, isNull, lte, or, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/mysql2';
import { seed } from 'drizzle-seed';

import {
	employee,
	department,
	position,
	employmentStatuses
} from '../src/lib/server/db/schema/staff';
import { branch } from '../src/lib/server/db/schema/branches';
import { patient, referralSource } from '../src/lib/server/db/schema/patients';
import { customers } from '../src/lib/server/db/schema/customers';
import { allergen, patientAllergies } from '../src/lib/server/db/schema/allergies';
import { condition, patientConditions } from '../src/lib/server/db/schema/conditions';
import { patientMedications } from '../src/lib/server/db/schema/medications';
import { medicine } from '../src/lib/server/db/schema/prescriptions';
import { appointment, appointmentType, operatory } from '../src/lib/server/db/schema/scheduling';
import { provider } from '../src/lib/server/db/schema/providers';
import { clinicClosure } from '../src/lib/server/db/schema/closures';
import { addClinicDays, clinicToday, fromClinic } from '../src/lib/clinicTime';
import {
	contactTypes,
	patientContacts,
	patientEmergencyContacts
} from '../src/lib/server/db/schema/contacts';

const url = process.env.DATABASE_URL;

if (!url) {
	console.error('DATABASE_URL is not set.');
	process.exit(1);
}

/*
 * Two locks, because a seeding script pointed at the wrong database is the kind of mistake that
 * has no undo. The host check catches the common accident; the flag catches the deliberate one.
 */
const host = new URL(url.replace(/^mysql:\/\//, 'http://')).hostname;
const isLocal = ['localhost', '127.0.0.1', '::1'].includes(host);

if (!isLocal && process.env.ALLOW_REMOTE_SEED !== 'yes') {
	console.error(
		`Refusing to seed a non-local database (${host}).\n` +
			`If you really mean it, set ALLOW_REMOTE_SEED=yes.`
	);
	process.exit(1);
}

if (!process.argv.includes('--yes')) {
	console.error(`This writes rows into ${host}. Re-run with --yes to confirm.`);
	process.exit(1);
}

const connection = await mysql.createPool(url);
const db = drizzle(connection);

/*
 * Written by hand rather than generated, and never reset: these are the values the generated
 * employees point at, and they are also what the column filters and the chart group by. Random
 * strings here would make the facets unreadable, which defeats the reason for seeding at all.
 */
const DEPARTMENTS = ['Reception', 'Clinical', 'Laboratory', 'Administration'];
const POSITIONS = ['Dentist', 'Nurse', 'Receptionist', 'Technician'];
const BRANCHES = ['Bole Clinic', 'Piassa Clinic'];
const STATUSES = ['Permanent', 'Contract'];

async function ensureLookups() {
	// `ignore` so a re-run tops the database up instead of failing on what is already there.
	await db
		.insert(department)
		.ignore()
		.values(DEPARTMENTS.map((name, i) => ({ id: 901 + i, name })));
	await db
		.insert(position)
		.ignore()
		.values(POSITIONS.map((name, i) => ({ id: 901 + i, name })));
	await db
		.insert(branch)
		.ignore()
		.values(BRANCHES.map((name, i) => ({ id: 901 + i, name })));
	await db
		.insert(employmentStatuses)
		.ignore()
		.values(STATUSES.map((name, i) => ({ id: 901 + i, name })));
}

async function main() {
	await ensureLookups();

	/*
	 * drizzle-seed numbers its rows from 1, so a second run collides on the primary key rather
	 * than topping up. `--fresh` is the honest way out: say plainly that it empties the table.
	 */
	if (process.argv.includes('--fresh')) {
		await db.delete(employee);
		console.log('Cleared employee.');
	}

	const rowCount = Number(process.env.SEED_COUNT ?? 120);

	// A second run without `--fresh` collides on drizzle-seed's ids; skip instead, so the patient
	// step below can still run on a database that already has its employees.
	const [{ staff }] = await db.select({ staff: count() }).from(employee);
	if (staff > 0) {
		console.log(`employee already holds ${staff} rows; skipping (use --fresh to reseed).`);
		await seedPatients();
		await seedScheduling();
		return;
	}

	/*
	 * `refine` rather than letting drizzle-seed invent everything: the columns the UI groups by
	 * have to come from the real lookup ids, and `approvalStatus` has to be `approved` or the
	 * rows land in the approval queue and the list stays empty — which is exactly the confusing
	 * half-success this script exists to avoid.
	 */
	await seed(db, { employee, employmentStatuses }, { count: rowCount }).refine((f) => ({
		// Exposed only so the FK on `employee` can be resolved; its real rows are written above.
		employmentStatuses: { count: 0 },
		employee: {
			columns: {
				/*
				 * Every column is refined, not just the interesting ones. Left to itself
				 * drizzle-seed fills a `varchar` with random characters, which gives you a
				 * nationality of "03GkdEfq61", 8,861 days of annual leave and hire dates in 2028.
				 * It is not wrong — it has no way to know what the column means — but data that
				 * cannot be read is barely better than an empty table for spotting a UI problem.
				 */
				name: f.firstName(),
				fatherName: f.lastName(),
				grandFatherName: f.lastName(),
				gender: f.valuesFromArray({ values: ['male', 'female'] }),
				nationality: f.default({ defaultValue: 'Ethiopian' }),
				bloodType: f.valuesFromArray({
					values: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
				}),
				idNo: f.int({ minValue: 100000, maxValue: 999999 }),
				tinNo: f.int({ minValue: 1000000000, maxValue: 9999999999 }),
				birthDate: f.date({ minDate: '1965-01-01', maxDate: '2004-12-31' }),
				hireDate: f.date({ minDate: '2015-01-01', maxDate: '2025-06-30' }),
				terminationDate: f.default({ defaultValue: null }),
				martialStatus: f.valuesFromArray({ values: ['single', 'married', 'divorced'] }),
				leavesLeft: f.number({ minValue: 0, maxValue: 30, precision: 10 }),
				// `photo` and `govtId` are NOT NULL, so they get a placeholder name rather than a
				// 200-character random string. Nothing is behind it — the file store is empty in
				// development — and a missing image reads more honestly than invented bytes.
				photo: f.default({ defaultValue: 'seed-placeholder.jpg' }),
				govtId: f.default({ defaultValue: 'seed-placeholder.jpg' }),
				signiture: f.default({ defaultValue: null }),
				pensionCard: f.default({ defaultValue: null }),
				address: f.default({ defaultValue: null }),
				existingPensionCard: f.default({ defaultValue: false }),

				departmentId: f.valuesFromArray({ values: DEPARTMENTS.map((_, i) => 901 + i) }),
				positionId: f.valuesFromArray({ values: POSITIONS.map((_, i) => 901 + i) }),
				branchId: f.valuesFromArray({ values: BRANCHES.map((_, i) => 901 + i) }),
				employmentStatus: f.valuesFromArray({ values: STATUSES.map((_, i) => 901 + i) }),
				educationalLevel: f.default({ defaultValue: null }),

				isActive: f.weightedRandom([
					{ weight: 0.85, value: f.default({ defaultValue: true }) },
					{ weight: 0.15, value: f.default({ defaultValue: false }) }
				]),
				// Without this every generated row lands in the approval queue and the list that
				// was supposed to be full stays empty.
				approvalStatus: f.default({ defaultValue: 'approved' }),
				approvalOverridden: f.default({ defaultValue: false }),
				createdBy: f.default({ defaultValue: null }),
				updatedBy: f.default({ defaultValue: null }),
				deletedBy: f.default({ defaultValue: null }),
				deletedAt: f.default({ defaultValue: null }),
				requestedBy: f.default({ defaultValue: null }),
				approvedBy: f.default({ defaultValue: null }),
				approvedAt: f.default({ defaultValue: null }),
				rejectedBy: f.default({ defaultValue: null }),
				rejectedAt: f.default({ defaultValue: null }),
				rejectionReason: f.default({ defaultValue: null })
			}
		}
	}));

	const [{ total }] = await db.select({ total: count() }).from(employee);

	console.log(`Seeded. employee now holds ${total} rows.`);

	await seedPatients();
	await seedScheduling();
}

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

/** mulberry32: small, seedable, good enough to spread fake rows around. */
function rng(seed: number) {
	return () => {
		seed |= 0;
		seed = (seed + 0x6d2b79f5) | 0;
		let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

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

async function seedPatients() {
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
	const branchIds = [1, ...BRANCHES.map((_, i) => 901 + i)];
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

/* ── Scheduling ────────────────────────────────────────────────────────────────────────────────
 *
 * Dentists, chairs and a month of appointments centred on today, so the day view opens on a real
 * day: finished visits in the morning, someone in the chair, someone waiting, and bookings to come.
 * Deterministic like the patients, and skipped when appointments already exist (`--fresh` clears
 * them). Uses `clinicTime` for every instant, the same as the app, so seeded 9:00 is 9:00 on screen.
 */
async function seedScheduling() {
	if (process.argv.includes('--fresh')) {
		await db.delete(appointment);
		console.log('Cleared appointments.');
	}

	const [{ existing }] = await db.select({ existing: count() }).from(appointment);
	if (existing > 0) {
		console.log(`appointment already holds ${existing} rows; skipping (use --fresh to reseed).`);
		return;
	}

	const random = rng(20260914);
	const pick = <T>(items: readonly T[]) => items[Math.floor(random() * items.length)];
	const chance = (p: number) => random() < p;

	// Dentists: a provider row for the first six employees in the Dentist position.
	const [{ providers: providerCount }] = await db.select({ providers: count() }).from(provider);
	if (providerCount === 0) {
		const dentists = await db
			.select({ id: employee.id })
			.from(employee)
			.where(and(eq(employee.positionId, 901), isNull(employee.deletedAt)))
			.limit(6);
		if (dentists.length) {
			await db.insert(provider).values(
				dentists.map((d, i) => ({
					employeeId: d.id,
					title: 'Dr',
					canPrescribe: true,
					defaultAppointmentMinutes: 30,
					licenceNumber: `SEED-LIC-${i + 1}`
				}))
			);
		}
	}

	// Chairs: a chair seeded before branches existed is filed under the main branch, then every
	// branch is topped up to three.
	await db.update(operatory).set({ branchId: 1 }).where(isNull(operatory.branchId));
	const branchIds = [1, ...BRANCHES.map((_, i) => 901 + i)];
	for (const branchId of branchIds) {
		const [{ chairs }] = await db
			.select({ chairs: count() })
			.from(operatory)
			.where(eq(operatory.branchId, branchId));
		for (let n = chairs + 1; n <= 3; n++) {
			await db.insert(operatory).values({ name: `Chair ${n}`, branchId, sortOrder: n });
		}
	}

	const [chairs, providers, types, patients] = await Promise.all([
		db
			.select({ id: operatory.id, branchId: operatory.branchId })
			.from(operatory)
			.where(eq(operatory.isActive, true)),
		db.select({ id: provider.id }).from(provider),
		db
			.select({ id: appointmentType.id, minutes: appointmentType.defaultMinutes })
			.from(appointmentType),
		db.select({ id: patient.id, branchId: patient.branchId }).from(patient)
	]);
	if (!patients.length || !types.length) {
		console.log('No patients or appointment types; skipping appointments.');
		return;
	}

	const today = clinicToday();
	const now = Date.now();
	let written = 0;

	for (let offset = -14; offset <= 14; offset++) {
		const day = addClinicDays(today, offset);
		// Sundays off, and any closure the clinic observes.
		if (new Date(`${day}T12:00:00Z`).getUTCDay() === 0) continue;

		for (const branchId of branchIds) {
			const [closed] = await db
				.select({ id: clinicClosure.id })
				.from(clinicClosure)
				.where(
					and(
						lte(clinicClosure.startsOn, sql`${day}`),
						gte(clinicClosure.endsOn, sql`${day}`),
						eq(clinicClosure.isActive, true),
						or(isNull(clinicClosure.branchId), eq(clinicClosure.branchId, branchId))
					)
				)
				.limit(1);
			if (closed) continue;

			const local = patients.filter((p) => p.branchId === branchId);
			const rows: (typeof appointment.$inferInsert)[] = [];

			for (const chair of chairs.filter((c) => c.branchId === branchId)) {
				// Walk the chair's day from 8:00, leaving gaps so the grid has room to click.
				let minute = 8 * 60 + Math.floor(random() * 4) * 15;
				while (minute < 17 * 60) {
					if (chance(0.3)) {
						minute += 30;
						continue;
					}
					const type = pick(types);
					const hh = String(Math.floor(minute / 60)).padStart(2, '0');
					const mm = String(minute % 60).padStart(2, '0');
					const startsAt = fromClinic(day, `${hh}:${mm}`);
					const end = startsAt.getTime() + type.minutes * 60_000;

					const status =
						end < now
							? chance(0.08)
								? 'noShow'
								: chance(0.08)
									? 'cancelled'
									: 'completed'
							: startsAt.getTime() <= now
								? 'inChair'
								: startsAt.getTime() - now < 45 * 60_000 && offset === 0
									? chance(0.5)
										? 'arrived'
										: 'confirmed'
									: chance(0.06)
										? 'cancelled'
										: chance(0.3)
											? 'confirmed'
											: 'scheduled';

					const arrived = new Date(startsAt.getTime() - Math.floor(random() * 20) * 60_000);
					const seated = new Date(startsAt.getTime() + Math.floor(random() * 15) * 60_000);

					rows.push({
						patientId: pick(local.length && chance(0.8) ? local : patients).id,
						branchId,
						operatoryId: chair.id,
						providerId: providers.length && chance(0.85) ? pick(providers).id : null,
						appointmentTypeId: type.id,
						startsAt,
						durationMinutes: type.minutes,
						status,
						isNewPatient: chance(0.1),
						isAsap: status === 'scheduled' && chance(0.1),
						confirmedAt: status === 'confirmed' ? new Date(startsAt.getTime() - 86_400_000) : null,
						arrivedAt: ['arrived', 'inChair', 'completed'].includes(status) ? arrived : null,
						seatedAt: ['inChair', 'completed'].includes(status) ? seated : null,
						dismissedAt: status === 'completed' ? new Date(end) : null,
						cancelledAt:
							status === 'cancelled' ? new Date(startsAt.getTime() - 2 * 86_400_000) : null,
						cancelReason: status === 'cancelled' ? 'Patient called to cancel (seed)' : null
					});

					minute += Math.ceil(type.minutes / 15) * 15;
				}
			}

			if (rows.length) {
				await db.insert(appointment).values(rows);
				written += rows.length;
			}
		}
	}

	console.log(`Seeded ${written} appointments across ${branchIds.length} branches.`);
}

await main();
await connection.end();
