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
	supplyBatch,
	user
} from '$lib/server/db/schema';
import { and, asc, eq, gt, sql } from 'drizzle-orm';
import { notDeleted } from '$lib/server/softDelete';
import type { LayoutServerLoad } from './$types';
import {
	employees,
	paymentMethods,
	supplyCategories,
	suppliers as supplierOptions
} from '$lib/server/fastData';
import { lotRecipients, onHand } from '$lib/server/stock';
import { hasPermission } from '$lib/server/permissions';

export const load: LayoutServerLoad = async ({ params, locals }) => {
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
			quantity: onHand(),
			description: supplies.description,
			unitOfMeasure: supplies.unitOfMeasure,
			reorderLevel: supplies.reorderLevel,
			returnable: supplies.returnable,
			tracksExpiry: supplies.tracksExpiry,
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
	const paymentMethodList = await paymentMethods();
	const supplierList = await supplierOptions();

	/*
	 * The lots still holding stock, in the order they will be used: soonest expiry first, undated
	 * last — the same order `moveStock` takes them in, so the top row is the next box to open.
	 */
	const lots = await db
		.select({
			id: supplyBatch.id,
			batchNumber: supplyBatch.batchNumber,
			expiryDate: supplyBatch.expiryDate,
			quantity: supplyBatch.quantity,
			receivedOn: supplyBatch.receivedOn,
			supplier: supplySuppliers.name
		})
		.from(supplyBatch)
		.leftJoin(
			supplySuppliers,
			and(eq(supplySuppliers.id, supplyBatch.supplierId), notDeleted(supplySuppliers))
		)
		.where(
			and(
				eq(supplyBatch.supplyId, Number(id)),
				eq(supplyBatch.status, 'active'),
				gt(supplyBatch.quantity, 0),
				notDeleted(supplyBatch)
			)
		)
		.orderBy(
			sql`${supplyBatch.expiryDate} IS NULL`,
			asc(supplyBatch.expiryDate),
			asc(supplyBatch.id)
		);

	const suppliers = await db
		.selectDistinct({
			id: supplySuppliers.id,
			name: supplySuppliers.name,
			phone: supplySuppliers.phone,
			email: supplySuppliers.email,
			description: supplySuppliers.description,
			// Not selected before, so the table's status column read every supplier as inactive.
			status: supplySuppliers.status
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

	// Names patients, so only for someone who may read patient records (CLAUDE.md §9).
	const recipients = hasPermission(locals, 'patients.view')
		? await lotRecipients(Number(id))
		: null;

	return {
		supply,
		recipients,
		form,
		adjustForm,
		damagedForm,
		employeesList,
		suppliers,
		supplierList,
		lots,
		typeList,
		paymentMethods: paymentMethodList
	};
};
