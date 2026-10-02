/**
 * Controlled medicines: tramadol and diazepam on the medicine list, a stock item of each at every
 * branch, deliveries with their batch and supplier, and doses issued to patients over the last two
 * months — so the register has two months of lines and a monthly return to print. Every issue
 * comes out of the lot the way `moveStock` would take it, so the register's balance agrees with the
 * shelf.
 */
import { and, eq, isNotNull, isNull } from 'drizzle-orm';

import { branch } from '../../src/lib/server/db/schema/branches';
import { medicine } from '../../src/lib/server/db/schema/prescriptions';
import { patient } from '../../src/lib/server/db/schema/patients';
import { supplyBatch } from '../../src/lib/server/db/schema/batches';
import {
	supplies,
	suppliesAdjustments,
	supplySuppliers,
	supplyTypes
} from '../../src/lib/server/db/schema/inventory';
import { dateAt, localDate, randomness, type SeedDb } from './util';

const CONTROLLED = [
	{
		genericName: 'Tramadol',
		strength: '50mg',
		form: 'capsule',
		controlClass: 'narcotic',
		unit: 'capsule'
	},
	{
		genericName: 'Diazepam',
		strength: '5mg',
		form: 'tablet',
		controlClass: 'psychotropic',
		unit: 'tablet'
	}
] as const;

export async function seedControlled(db: SeedDb) {
	const [already] = await db
		.select({ id: medicine.id })
		.from(medicine)
		.where(isNotNull(medicine.controlClass))
		.limit(1);
	if (already) {
		console.log('Controlled medicines already marked; skipping.');
		return;
	}

	const [pharmacy] = await db
		.select({ id: supplyTypes.id })
		.from(supplyTypes)
		.where(eq(supplyTypes.name, 'Pharmacy'))
		.limit(1);
	const [supplier] = await db.select({ id: supplySuppliers.id }).from(supplySuppliers).limit(1);
	const branches = await db.select({ id: branch.id }).from(branch).where(isNull(branch.deletedAt));
	const patients = await db
		.select({ id: patient.id, branchId: patient.branchId })
		.from(patient)
		.limit(300);
	if (!pharmacy || !supplier || !patients.length) {
		console.log('No pharmacy type, supplier or patients; skipping controlled medicines.');
		return;
	}

	const { pick, between } = randomness(20261008);
	let issued = 0;

	for (const drug of CONTROLLED) {
		const [found] = await db
			.select({ id: medicine.id })
			.from(medicine)
			.where(and(eq(medicine.genericName, drug.genericName), eq(medicine.strength, drug.strength)))
			.limit(1);
		const medicineId =
			found?.id ??
			(
				await db
					.insert(medicine)
					.values({
						genericName: drug.genericName,
						strength: drug.strength,
						form: drug.form,
						controlClass: drug.controlClass
					})
					.$returningId()
			)[0].id;
		await db
			.update(medicine)
			.set({ controlClass: drug.controlClass })
			.where(eq(medicine.id, medicineId));

		for (const place of branches) {
			const [{ id: supplyId }] = await db
				.insert(supplies)
				.values({
					supplyTypeId: pharmacy.id,
					name: `${drug.genericName} ${drug.strength}`,
					unitOfMeasure: drug.unit,
					reorderLevel: 20,
					medicineId,
					tracksExpiry: true,
					branchId: place.id
				})
				.$returningId();

			// One delivery two months ago, and the doses given since, oldest first.
			const received = 100;
			const receivedAt = dateAt(-60);
			const [{ id: batchId }] = await db
				.insert(supplyBatch)
				.values({
					supplyId,
					batchNumber: `${drug.genericName.slice(0, 3).toUpperCase()}-${between(1000, 9999)}`,
					expiryDate: localDate(400),
					quantity: received,
					receivedQuantity: received,
					supplierId: supplier.id,
					receivedOn: localDate(-60),
					branchId: place.id
				})
				.$returningId();
			await db.insert(suppliesAdjustments).values({
				suppliesId: supplyId,
				movementType: 'received',
				adjustment: received,
				batchId,
				supplierId: supplier.id,
				createdAt: receivedAt
			});

			let left = received;
			const local = patients.filter((p) => p.branchId === place.id);
			for (let daysAgo = 58; daysAgo > 0; daysAgo -= between(2, 6)) {
				const dose = drug.genericName === 'Tramadol' ? between(6, 10) : between(1, 3);
				if (dose > left) break;
				left -= dose;
				await db.insert(suppliesAdjustments).values({
					suppliesId: supplyId,
					movementType: 'dispensed',
					adjustment: -dose,
					batchId,
					patientId: pick(local.length ? local : patients).id,
					createdAt: dateAt(-daysAgo)
				});
				issued++;
			}
			await db.update(supplyBatch).set({ quantity: left }).where(eq(supplyBatch.id, batchId));
		}
	}
	console.log(`controlled medicines: ${issued} doses issued across the branches.`);
}
