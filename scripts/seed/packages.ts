/**
 * Treatment packages: one of each kind, built from services the catalogue already has — a prepaid
 * year of cleanings, and a check-up bundle — so both billing paths have something to try. Skipped
 * when the services they need are not in the catalogue.
 */
import { and, inArray, isNull } from 'drizzle-orm';

import { services } from '../../src/lib/server/db/schema/services';
import { treatmentPackage, treatmentPackageItem } from '../../src/lib/server/db/schema/packages';
import { isEmpty, type SeedDb } from './util';

const PACKAGES = [
	{
		name: 'Cleanings for a year',
		kind: 'prepaid' as const,
		price: 2500,
		validDays: 365,
		description: 'Two scale-and-polish visits within the year',
		items: [{ service: 'Scaling and polishing', quantity: 2 }]
	},
	{
		name: 'Check-up and clean',
		kind: 'bundle' as const,
		price: 1500,
		validDays: null,
		description: 'Consultation, scaling and a fluoride application, done together',
		items: [
			{ service: 'Consultation', quantity: 1 },
			{ service: 'Scaling and polishing', quantity: 1 },
			{ service: 'Fluoride application', quantity: 1 }
		]
	}
];

export async function seedPackages(db: SeedDb) {
	if (!(await isEmpty(db, treatmentPackage, 'treatment_package'))) return;
	const names = [...new Set(PACKAGES.flatMap((p) => p.items.map((i) => i.service)))];
	const found = await db
		.select({ id: services.id, name: services.name })
		.from(services)
		.where(and(inArray(services.name, names), isNull(services.deletedAt)));
	const idOf = new Map(found.map((s) => [s.name, s.id]));

	let made = 0;
	for (const p of PACKAGES) {
		if (!p.items.every((i) => idOf.has(i.service))) continue;
		const [{ id }] = await db
			.insert(treatmentPackage)
			.values({
				name: p.name,
				kind: p.kind,
				price: p.price,
				validDays: p.validDays,
				description: p.description
			})
			.$returningId();
		await db.insert(treatmentPackageItem).values(
			p.items.map((i) => ({
				packageId: id,
				serviceId: idOf.get(i.service) ?? 0,
				quantity: i.quantity
			}))
		);
		made++;
	}
	console.log(`treatment_package: ${made} packages.`);
}
