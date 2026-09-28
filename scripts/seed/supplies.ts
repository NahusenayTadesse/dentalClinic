/**
 * Suppliers, what the clinic buys from them, and the stock movements that give an item an on-hand
 * figure.
 *
 * The suppliers list is also the only screen that draws the address cell, so its addresses are real
 * rows rather than nulls — a component with no data on any screen is a component nobody can check.
 */

import {
	supplies,
	supplySuppliers,
	suppliesAdjustments,
	supplyTypes
} from '../../src/lib/server/db/schema/inventory';
import { supplyBatch } from '../../src/lib/server/db/schema/batches';
import { employee } from '../../src/lib/server/db/schema/staff';
import { subcity } from '../../src/lib/server/db/schema/locations';
import { makeAddress } from './reference';
import { isEmpty, localDate, money, randomness, type SeedDb } from './util';

const SUPPLIERS = [
	{ name: 'Probe Dental Supplies', phone: '0114001001' },
	{ name: 'Seedwell Medical Import', phone: '0114001002' },
	{ name: 'Fixture Lab Materials', phone: '0114001003' },
	{ name: 'Sample Pharmaceuticals', phone: '0114001004' }
];

/** `expires`: the item goes off, so every lot of it is dated — see `supplies.tracksExpiry`. */
const CATALOGUE = [
	{ name: 'Composite resin A2', unit: 'syringe', reorder: 10, expires: true },
	{ name: 'Dental amalgam capsules', unit: 'box', reorder: 5, expires: true },
	{ name: 'Lidocaine 2% cartridges', unit: 'box', reorder: 8, expires: true },
	{ name: 'Examination gloves (M)', unit: 'box', reorder: 20, expires: false },
	{ name: 'Face masks', unit: 'box', reorder: 20, expires: false },
	{ name: 'Suture 3-0', unit: 'pack', reorder: 6, expires: true },
	{ name: 'Impression material', unit: 'kit', reorder: 4, expires: true },
	{ name: 'Fluoride varnish', unit: 'tube', reorder: 6, expires: true },
	{ name: 'Radiograph film', unit: 'pack', reorder: 5, expires: true },
	{ name: 'Disposable bibs', unit: 'pack', reorder: 15, expires: false }
];

export async function seedSupplies(db: SeedDb) {
	if (!(await isEmpty(db, supplySuppliers, 'supply_suppliers'))) return;

	const { pick, between, chance } = randomness(20260927);
	const [types, subcities, staff] = await Promise.all([
		db.select({ id: supplyTypes.id }).from(supplyTypes),
		db.select({ id: subcity.id }).from(subcity),
		db.select({ id: employee.id }).from(employee).limit(20)
	]);

	if (!types.length) {
		console.log('No supply types; skipping supplies.');
		return;
	}

	const supplierIds: number[] = [];
	for (const [index, supplier] of SUPPLIERS.entries()) {
		const addressId = await makeAddress(db, {
			subcityId: subcities.length ? pick(subcities).id : null,
			street: `Supplier Road ${index + 1}`,
			kebele: String(between(1, 15)),
			// Half are recorded down to the office, half stop at the street — both are normal here.
			...(index % 2 === 0
				? {
						buildingNumber: `S-${between(1, 30)}`,
						floor: between(1, 5),
						houseNumber: between(1, 40)
					}
				: {})
		});

		const [row] = await db
			.insert(supplySuppliers)
			.values({
				...supplier,
				email: `supplier${index + 1}@example.test`,
				description: 'Seed supplier',
				address: addressId
			})
			.$returningId();
		supplierIds.push(row.id);
	}

	for (const item of CATALOGUE) {
		const [row] = await db
			.insert(supplies)
			.values({
				supplyTypeId: pick(types).id,
				name: item.name,
				unitOfMeasure: item.unit,
				reorderLevel: item.reorder,
				tracksExpiry: item.expires,
				description: 'Seed stock item'
			})
			.$returningId();

		// One delivery, then some usage — enough for an on-hand figure that is not the delivery.
		const received = between(20, 120);
		await db.insert(supplyBatch).values({
			supplyId: row.id,
			batchNumber: `B-${between(1000, 9999)}`,
			expiryDate: item.expires ? localDate(between(90, 900)) : null,
			quantity: received,
			receivedQuantity: received,
			receivedOn: localDate(-between(10, 60))
		});

		// A short-dated box beside the main lot, so the expiring-soon state is on screen from the
		// first run rather than only after someone receives stock.
		if (item.name.startsWith('Lidocaine')) {
			await db.insert(supplyBatch).values({
				supplyId: row.id,
				batchNumber: `B-${between(1000, 9999)}`,
				expiryDate: localDate(between(20, 45)),
				quantity: 6,
				receivedQuantity: 6,
				receivedOn: localDate(-between(120, 200))
			});
		}

		await db.insert(suppliesAdjustments).values({
			movementType: 'received',
			suppliesId: row.id,
			adjustment: received,
			supplierId: pick(supplierIds),
			employeeResponsible: staff.length ? pick(staff).id : null,
			reason: 'Opening delivery (seed)',
			costPerItem: money(between(20, 400)),
			total: money(received * 50)
		});

		if (chance(0.8)) {
			const used = between(1, Math.max(1, Math.floor(received / 3)));
			await db.insert(suppliesAdjustments).values({
				movementType: 'consumed',
				suppliesId: row.id,
				adjustment: -used,
				employeeResponsible: staff.length ? pick(staff).id : null,
				reason: 'Used at the chair (seed)'
			});
		}
	}

	console.log(
		`Seeded ${SUPPLIERS.length} suppliers and ${CATALOGUE.length} stock items with movements.`
	);
}
