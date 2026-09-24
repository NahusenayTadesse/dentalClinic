/**
 * Dentists, chairs, and a month of appointments centred on today.
 *
 * Moved out of `seed-dev.ts` when the seed outgrew one file (CLAUDE.md §6).
 */
import { and, count, eq, gte, isNull, lte, or, sql } from 'drizzle-orm';

import { employee } from '../../src/lib/server/db/schema/staff';
import { patient } from '../../src/lib/server/db/schema/patients';
import { appointment, appointmentType, operatory } from '../../src/lib/server/db/schema/scheduling';
import { provider } from '../../src/lib/server/db/schema/providers';
import { clinicClosure } from '../../src/lib/server/db/schema/closures';
import { addClinicDays, clinicToday, fromClinic } from '../../src/lib/clinicTime';
import { rng, type SeedDb } from './util';

/* ── Scheduling ────────────────────────────────────────────────────────────────────────────────
 *
 * Dentists, chairs and a month of appointments centred on today, so the day view opens on a real
 * day: finished visits in the morning, someone in the chair, someone waiting, and bookings to come.
 * Deterministic like the patients, and skipped when appointments already exist (`--fresh` clears
 * them). Uses `clinicTime` for every instant, the same as the app, so seeded 9:00 is 9:00 on screen.
 */
export async function seedScheduling(db: SeedDb, branches: string[]) {
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
				/*
				 * Licence expiries spread across the three states the providers screen colours —
				 * expired, expiring inside the warning window, and comfortably valid — so the screen
				 * can be read at a glance in development.
				 */
				dentists.map((d, i) => {
					const inDays = [-40, 20, 200, 500, -5, 90][i % 6];
					const expires = new Date(Date.now() + inDays * 86_400_000);
					return {
						employeeId: d.id,
						title: 'Dr',
						canPrescribe: true,
						defaultAppointmentMinutes: 30,
						licenceNumber: `SEED-LIC-${i + 1}`,
						licenceBody: 'Ministry of Health',
						licenceExpiresOn: expires.toISOString().slice(0, 10)
					};
				})
			);
		}
	}

	// Chairs: a chair seeded before branches existed is filed under the main branch, then every
	// branch is topped up to three.
	await db.update(operatory).set({ branchId: 1 }).where(isNull(operatory.branchId));
	const branchIds = [1, ...branches.map((_, i) => 901 + i)];
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
