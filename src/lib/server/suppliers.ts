import { and, eq } from 'drizzle-orm';
import { insertReturningId } from '@nahu/admin-kit/server/db/insert.js';
import { db } from '$lib/server/db';
import { address, supplySuppliers } from '$lib/server/db/schema/';
import { notDeleted } from '$lib/server/softDelete';
import type { Supplier } from '$lib/forms/supplier';

/**
 * Writing a supplier: the supplier row and the address row it owns, together.
 *
 * The add page, the list page and the detail page each carried their own copy of this, and two of
 * the three were broken (an undefined `status`, a `location` column that does not exist). One
 * function now does both writes in one transaction, so a supplier is never left pointing at half
 * an address.
 *
 * Not audited: suppliers are reference data, and carry `status`/`deletedBy` like other lookup rows
 * (CLAUDE.md §11). Deleting is `softDeleteSupplier`, which takes the address too.
 */

const addressOf = (data: Supplier) => ({
	subcityId: data.subcity,
	street: data.street || null,
	kebele: data.kebele || null,
	buildingNumber: data.buildingNumber || null,
	floor: data.floor,
	houseNumber: data.houseNumber
});

const supplierOf = (data: Supplier) => ({
	name: data.name,
	phone: data.phone,
	email: data.email || null,
	description: data.description || null,
	status: data.status
});

/** Adds a supplier and its address. Returns the new supplier's id. */
export async function addSupplier(data: Supplier): Promise<number> {
	return db.transaction(async (tx) => {
		const addressId = await insertReturningId(tx, address, addressOf(data));
		return insertReturningId(tx, supplySuppliers, { ...supplierOf(data), address: addressId });
	});
}

/**
 * Changes a supplier and its address. The address is found from the supplier row — never from
 * the form — and made if the supplier never had one. Returns false when there is no such supplier.
 */
export async function updateSupplier(id: number, data: Supplier): Promise<boolean> {
	return db.transaction(async (tx) => {
		const [current] = await tx
			.select({ addressId: supplySuppliers.address })
			.from(supplySuppliers)
			.where(and(eq(supplySuppliers.id, id), notDeleted(supplySuppliers)));
		if (!current) return false;

		let addressId = current.addressId;
		if (addressId) await tx.update(address).set(addressOf(data)).where(eq(address.id, addressId));
		else addressId = await insertReturningId(tx, address, addressOf(data));

		await tx
			.update(supplySuppliers)
			.set({ ...supplierOf(data), address: addressId })
			.where(eq(supplySuppliers.id, id));
		return true;
	});
}
