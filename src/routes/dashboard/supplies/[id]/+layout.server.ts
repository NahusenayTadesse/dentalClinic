import { superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import {
	inventoryAdjustmentFormSchema as adjustSchema,
	damagedFormSchema as damagedSchema
} from '$lib/ZodSchema';
import { edit as schema } from './schema';
import { error } from '@sveltejs/kit';

import { db } from '$lib/server/db';
import {
	supplies,
	supplyTypes,
	supplySuppliers,
	suppliesAdjustments,
	site,
	supplyLeaseItems,
	supplyLeases,
	user
} from '$lib/server/db/schema';
import { and, desc, eq, sql } from 'drizzle-orm';
import { notDeleted } from '$lib/server/softDelete';
import { stockBySupply, stockFor } from '$lib/server/supplyStock';
import type { LayoutServerLoad } from './$types';
import { banks, employees, supplyCategories } from '$lib/server/fastData';

export const load: LayoutServerLoad = async ({ params }) => {
	const { id } = params;
	const form = await superValidate(zod4(schema));
	const adjustForm = await superValidate(zod4(adjustSchema));
	const damagedForm = await superValidate(zod4(damagedSchema));

	const supply = await db
		.select({
			id: supplies.id,

			name: supplies.name,
			supplyTypeId: supplies.supplyTypeId,
			supplyType: supplyTypes.name,
			quantity: supplies.quantity,
			description: supplies.description,
			unitOfMeasure: supplies.unitOfMeasure,
			reorderLevel: supplies.reorderLevel,
			returnable: supplies.returnable,
			createdBy: user.name,
			createdById: sql<string | null>`CASE WHEN ${user.deletedAt} IS NULL THEN ${user.id} END`,
			createdAt: supplies.createdAt
		})
		.from(supplies)
		.leftJoin(supplyTypes, and(eq(supplies.supplyTypeId, supplyTypes.id), notDeleted(supplyTypes)))
		.leftJoin(user, eq(supplies.createdBy, user.id))
		.where(and(eq(supplies.id, Number(id)), notDeleted(supplies)))
		.then((rows) => rows[0]);

	const employeesList = await employees();
	const typeList = await supplyCategories();
	const bankList = await banks();

	const suppliers = await db
		.selectDistinct({
			id: supplySuppliers.id,
			name: supplySuppliers.name,
			phone: supplySuppliers.phone,
			email: supplySuppliers.email,
			description: supplySuppliers.description
		})
		.from(supplySuppliers)
		.innerJoin(
			suppliesAdjustments,
			and(eq(supplySuppliers.id, suppliesAdjustments.supplierId), notDeleted(suppliesAdjustments))
		)
		.where(eq(suppliesAdjustments.suppliesId, Number(id)));

	if (!supply) {
		throw error(404, 'Supply not found, it has been deleted or never have existed.');
	}

	// The company owns this stock wherever it sits, so the detail page shows all
	// four figures. Reserved and leased-out are summed from the lease rows on
	// every read rather than cached — see `supplyStock.ts`.
	const stockMap = await stockBySupply([Number(id)]);
	const stock = stockFor(Number(id), supply.quantity, stockMap);

	/** Which sites are currently holding this item, and how much. */
	const leasedTo = await db
		.select({
			id: supplyLeases.id,
			site: site.name,
			status: supplyLeases.status,
			issued: supplyLeaseItems.quantityIssued,
			returned: supplyLeaseItems.quantityReturned,
			writtenOff: supplyLeaseItems.quantityWrittenOff,
			outstanding: sql<number>`GREATEST(${supplyLeaseItems.quantityIssued}
				- ${supplyLeaseItems.quantityReturned}
				- ${supplyLeaseItems.quantityWrittenOff}, 0)`,
			// Raw date; the column formats it with `formatEthiopianDate`.
			expectedReturnDate: supplyLeases.expectedReturnDate,
			requestedBy: user.name,
			requestedById: sql<string | null>`CASE WHEN ${user.deletedAt} IS NULL THEN ${user.id} END`
		})
		.from(supplyLeaseItems)
		.innerJoin(
			supplyLeases,
			and(eq(supplyLeases.id, supplyLeaseItems.leaseId), notDeleted(supplyLeases))
		)
		.leftJoin(site, and(eq(supplyLeases.siteId, site.id), notDeleted(site)))
		.leftJoin(user, eq(supplyLeases.requestedBy, user.id))
		.where(and(eq(supplyLeaseItems.supplyId, Number(id)), notDeleted(supplyLeaseItems)))
		.orderBy(desc(supplyLeases.requestedAt));

	return {
		supply,
		stock,
		leasedTo,
		form,
		adjustForm,
		damagedForm,
		employeesList,
		suppliers,
		typeList,
		bankList
	};
};
