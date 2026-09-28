import { superValidate, message, setError } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import {
	inventoryAdjustmentFormSchema as adjustSchema,
	damagedFormSchema as damagedSchema
} from '$lib/ZodSchema';

import { edit as schema } from './schema';

import { db } from '$lib/server/db';
import { moveStock } from '$lib/server/stock';
import { WriteRefused } from '$lib/server/childCrud';
import { insertReturningId } from '$lib/server/db/insert';
import { clinicToday } from '$lib/clinicTime';
import {
	supplies,
	deductions,
	damagedSupplies,
	transactions,
	suppliesAdjustments
} from '$lib/server/db/schema';
import { eq, and, isNotNull, desc } from 'drizzle-orm';
import { notDeleted, softDeleteSupply } from '$lib/server/softDelete';
import { requireSuperAdmin } from '$lib/server/permissions';
import type { Actions } from './$types';
import { fail } from 'sveltekit-superforms';
import { setFlash, redirect } from 'sveltekit-flash-message/server';
import { saveUploadedFile } from '$lib/server/upload';

// export const load: PageServerLoad = async ({ params, locals }) => {
// 	const { id } = params;
// 	const form = await superValidate(zod4(schema));
// 	const adjustForm = await superValidate(zod4(adjustSchema));

// 	const supply = await db
// 		.select({
// 			id: supplies.id,
// 			name: supplies.name,
// 			costPerUnit: supplies.costPerUnit,
// 			description: supplies.description,
// 			quantity: supplies.quantity,
// 			reorderLevel: supplies.reorderLevel,
// 			unitOfMeasure: supplies.unitOfMeasure,
// 			supplier: supplies.supplier,
// 			createdBy: user.name,
// 			createdAt: sql<string>`DATE_FORMAT(${supplies.createdAt}, '%Y-%m-%d')`,
// 			paidAmount: sql<number>`COALESCE(SUM(${transactions.amount}), 0)`
// 		})
// 		.from(supplies)
// 		.leftJoin(user, eq(supplies.createdBy, user.id))
// 		.where(and(eq(supplies.branchId, locals?.user?.branch), eq(supplies.id, id)))
// 		.groupBy(
// 			supplies.id,
// 			supplies.name,
// 			supplies.costPerUnit,
// 			supplies.description,
// 			supplies.quantity,
// 			supplies.reorderLevel,
// 			supplies.supplier,
// 			user.name,
// 			supplies.createdAt
// 		)
// 		.then((rows) => rows[0]);

// 	if (!supply) {
// 		throw error(404, 'Supply not found, it has been deleted or never have existed.');
// 	}

// 	return {
// 		supply,
// 		form,
// 		adjustForm
// 	};
// };

export const actions: Actions = {
	editSupply: async ({ request, cookies, locals, params }) => {
		const form = await superValidate(request, zod4(schema));
		const { id } = params;

		if (!form.valid) {
			// Stay on the same page and set a flash message
			setFlash({ type: 'error', message: 'Please check your form data.' }, cookies);
			return fail(400, { form });
		}

		const {
			name,
			description,
			supplyType,
			unitOfMeasurement,
			otherUnitOfMeasurement,
			reorderLevel,
			returnable,
			tracksExpiry
		} = form.data;

		try {
			await db
				.update(supplies)
				.set({
					name,
					description,
					supplyTypeId: Number(supplyType),
					// `quantity` is deliberately not set here: it is a running total
					// kept by adjustments and damage reports, and
					// this form has no business resetting it.
					unitOfMeasure: unitOfMeasurement === 'other' ? otherUnitOfMeasurement : unitOfMeasurement,
					reorderLevel,
					returnable,
					tracksExpiry,
					updatedBy: locals?.user?.id
				})
				.where(eq(supplies.id, Number(id)));

			// Stay on the same page and set a flash message
			return message(form, { type: 'success', text: 'Supply updated successfully' });
		} catch (err: unknown) {
			// Loud in the log, quiet to the client (CLAUDE.md §9). This line was a single mangled
			// template string, so the toast's type was the whole sentence and it never showed red.
			console.error('editSupply failed', err);
			return message(form, { type: 'error', text: 'The item could not be saved.' });
		}
	},
	adjust: async ({ request, params, locals }) => {
		// `const { id } = Number(params)` — the previous version destructured `id`
		// off a number, so it was always undefined and the guard below rejected
		// every adjustment.
		const id = Number(params.id);
		const form = await superValidate(request, zod4(adjustSchema));

		if (!form.valid) {
			return message(form, { type: 'error', text: 'Please check the form for errors' });
		}

		const { intent, quantity, costPerItem, reason, reciept, paymentMethod } = form.data;
		const expiryDate = form.data.expiryDate || null;
		const supplierId = Number(form.data.supplierId) || null;

		if (!id) {
			return message(form, { type: 'error', text: 'Unexpected Error: Supply ID not provided' });
		}

		const adjustment = intent === 'add' ? Number(quantity) : -Number(quantity);

		/*
		 * A delivery of something that expires must say when. `tracksExpiry` is set on the item, so
		 * this is the only place that knows to ask; without it the lot would be undated and used
		 * last, which is the opposite of what expiry tracking is for. Stock already past its date is
		 * refused outright — it should never enter the store.
		 */
		if (intent === 'add') {
			const [item] = await db
				.select({ tracksExpiry: supplies.tracksExpiry })
				.from(supplies)
				.where(eq(supplies.id, id))
				.limit(1);
			if (item?.tracksExpiry && !expiryDate) {
				return setError(form, 'expiryDate', 'This item expires — enter the date on the box.');
			}
			if (expiryDate && expiryDate <= clinicToday()) {
				return setError(
					form,
					'expiryDate',
					'That is today or already past — expired stock is not received.'
				);
			}
		}
		const total = adjustment * Number(costPerItem ?? 0);

		// Buying stock spends money, so it has to come out of a named account.
		// Removing stock costs nothing, which is why this is only required here.
		if (total > 0 && !paymentMethod) {
			return setError(form, 'paymentMethod', 'Choose how this was paid');
		}

		try {
			await db.transaction(async (tx) => {
				let transactionId: number | null = null;

				if (total > 0 && paymentMethod) {
					const recieptLink = reciept ? await saveUploadedFile(reciept) : null;

					const [created] = await tx
						.insert(transactions)
						.values({
							amount: -Math.abs(total),
							direction: 'out',
							paymentMethodId: paymentMethod,
							recieptLink,
							description: `Stock purchase${reason ? ': ' + reason : ''}`,
							paymentStatus: 'paid',
							createdBy: locals.user?.id
						})
						.$returningId();

					transactionId = created.id;

					// What was bought is on the ledger row below (`suppliesAdjustments.transactionId`),
					// which is why no separate purchase-line table is written.
				}

				/*
				 * Stock is the sum of the item's open lots, so the movement happens in the lots and
				 * the ledger records why. A receipt creates a lot; an issue takes from the ones
				 * expiring soonest. `moveStock` returns what it touched, so the ledger row can name
				 * the lot — which is how a recall is traced back to a patient.
				 */
				const touched = await moveStock(tx, {
					supplyId: id,
					delta: adjustment,
					userId: locals.user?.id,
					unitCost: costPerItem ?? null,
					// Only a receipt creates a lot; an issue ignores these.
					batchNumber: form.data.batchNumber?.trim() || null,
					expiryDate,
					supplierId
				});

				const moved = touched.reduce((sum, lot) => sum + lot.quantity, 0);

				// One ledger row per lot touched, so every row points at exactly one lot.
				for (const lot of touched) {
					await tx.insert(suppliesAdjustments).values({
						suppliesId: id,
						adjustment: lot.quantity,
						batchId: lot.batchId,
						movementType: adjustment > 0 ? 'received' : 'correction',
						costPerItem: costPerItem ? String(costPerItem) : null,
						total: total ? String(total) : null,
						reason,
						transactionId,
						createdBy: locals.user?.id
					});
				}

				/*
				 * An issue larger than the lots hold is not silently rounded away. The shelf and the
				 * system already disagreed; saying so is more useful than pretending otherwise.
				 */
				if (moved !== adjustment) {
					throw new Error(
						`Only ${Math.abs(moved)} of ${Math.abs(adjustment)} units are in stock and in date — expired lots are written off as damaged, not issued`
					);
				}
			});

			return message(form, { type: 'success', text: 'Supply Quantity updated successfully' });
		} catch (err) {
			console.error('Error adjusting product:', err);
			return message(form, {
				type: 'error',
				text: `Unexpected Error: ${err instanceof Error ? err.message : 'Unknown error'}`
			});
		}
	},
	/**
	 * A damage report: the report row, the units out of their lots, and — when the damage is the
	 * employee's to pay for — a payroll deduction, all in one transaction.
	 *
	 * Rewritten after four faults, each silent: the report was a `db.update` with no `where`, so every
	 * new report overwrote every earlier one; the ledger rows never named the report, so undoing it
	 * put nothing back on the shelf; the deduction left out its date, a required column, so a
	 * deductible report always failed after the stock had already moved; and an item with no known
	 * cost priced the deduction at NaN.
	 */
	damaged: async ({ params, locals, request }) => {
		const form = await superValidate(request, zod4(damagedSchema));
		if (!form.valid) return fail(400, { form });

		const supplyId = Number(params.id);
		const quantity = Number(form.data.quantity);
		const damagedBy = Number(form.data.damagedBy) || null;
		const { deductable } = form.data;
		const reason = form.data.reason?.trim() || 'Damaged';

		if (!(quantity > 0)) return setError(form, 'quantity', 'Enter how many were damaged.');
		if (deductable && !damagedBy) {
			return setError(form, 'damagedBy', 'Choose who pays for it, or untick deductible.');
		}

		try {
			await db.transaction(async (tx) => {
				const damagedId = await insertReturningId(tx, damagedSupplies, {
					supplyId,
					quantity,
					damagedBy,
					deductable,
					reason,
					createdBy: locals.user?.id
				});

				// Damage takes units out of lots, expired ones included: writing off an expired box is
				// the commonest damage report there is.
				const touched = await moveStock(tx, {
					supplyId,
					delta: -quantity,
					userId: locals.user?.id,
					includeExpired: true
				});
				const moved = touched.reduce((sum, lot) => sum - lot.quantity, 0);
				if (moved !== quantity) {
					throw new WriteRefused('quantity', `Only ${moved} are in stock.`);
				}

				// One ledger row per lot, each naming the report — which is what lets
				// `softDeleteDamagedSupply` put the units back into the lots they came from.
				for (const lot of touched) {
					await tx.insert(suppliesAdjustments).values({
						suppliesId: supplyId,
						adjustment: lot.quantity,
						batchId: lot.batchId,
						damagedSuppliesId: damagedId,
						movementType: 'damaged',
						reason,
						createdBy: locals.user?.id
					});
				}

				if (deductable && damagedBy) {
					const [cost] = await tx
						.select({ costPerItem: suppliesAdjustments.costPerItem })
						.from(suppliesAdjustments)
						.where(
							and(
								eq(suppliesAdjustments.suppliesId, supplyId),
								isNotNull(suppliesAdjustments.costPerItem),
								notDeleted(suppliesAdjustments)
							)
						)
						.orderBy(desc(suppliesAdjustments.createdAt))
						.limit(1);
					const unitCost = Number(cost?.costPerItem);
					if (!(unitCost > 0)) {
						throw new WriteRefused(
							'deductable',
							'No delivery of this item has a cost recorded, so there is nothing to deduct.'
						);
					}

					await tx.insert(deductions).values({
						staffId: damagedBy,
						type: 'Damaged Supply Item',
						reason,
						amount: (quantity * unitCost).toFixed(2),
						// A `date` column in Date mode; midnight UTC of the clinic's day is that day.
						deductionDate: new Date(clinicToday()),
						createdBy: locals.user?.id
					});
				}
			});

			return message(form, { type: 'success', text: 'Damage recorded.' });
		} catch (err: unknown) {
			// Thrown rather than returned, so the transaction rolls back: a refused report leaves no
			// report row and no units moved.
			if (err instanceof WriteRefused) {
				if (err.field === 'quantity' || err.field === 'deductable') {
					return setError(form, err.field, err.message);
				}
				return message(form, { type: 'error', text: err.message }, { status: 400 });
			}
			console.error('Error adding damaged supply:', err);
			return message(form, { type: 'error', text: 'The damage report could not be saved.' });
		}
	},
	/**
	 * Soft delete. Super admin only — `requireSuperAdmin` throws 403 rather than
	 * failing quietly, because the hidden button is UX, not access control.
	 *
	 * This used to be a `db.delete(supplies)` with no permission check at all,
	 * which any user who could reach the page could fire and which the adjustment
	 * and damage rows' foreign keys would have blocked anyway.
	 */
	delete: async ({ cookies, params, locals }) => {
		requireSuperAdmin(locals);
		const { id } = params;

		if (!id) {
			setFlash({ type: 'error', message: 'Unexpected Error: missing supply id' }, cookies);
			return fail(400);
		}

		try {
			await db.transaction(async (tx) => {
				await softDeleteSupply(tx, Number(id), locals.user?.id);
			});
		} catch (err) {
			console.error('Error deleting supply:', err);
			setFlash(
				{
					type: 'error',
					message: `Could not delete supply: ${err instanceof Error ? err.message : 'Unknown error'}`
				},
				cookies
			);
			return fail(500);
		}

		redirect(
			'/dashboard/supplies',
			{ type: 'success', message: 'Supply, its adjustments and damage reports deleted.' },
			cookies
		);
	}
};
