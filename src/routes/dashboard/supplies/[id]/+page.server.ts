import { superValidate, message, setError } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import {
	inventoryAdjustmentFormSchema as adjustSchema,
	damagedFormSchema as damagedSchema
} from '$lib/ZodSchema';

import { edit as schema } from './schema';

import { db } from '$lib/server/db';
import {
	supplies,
	deductions,
	damagedSupplies,
	transactionSupplies,
	transactions,
	suppliesAdjustments
} from '$lib/server/db/schema';
import { eq, sql, and, isNotNull, desc } from 'drizzle-orm';
import { notDeleted, softDeleteSupply } from '$lib/server/softDelete';
import {
	overdraftCheck,
	overdraftMessage,
	paymentMethodForBank,
	postToBank
} from '$lib/server/bankLedger';
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
// 		.leftJoin(transactionSupplies, eq(supplies.id, transactionSupplies.supplyId))
// 		.leftJoin(transactions, eq(transactionSupplies.transactionId, transactions.id))
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
			returnable
		} = form.data;

		try {
			await db
				.update(supplies)
				.set({
					name,
					description,
					supplyTypeId: Number(supplyType),
					// `quantity` is deliberately not set here: it is a running total
					// kept by adjustments, damage reports and lease movements, and
					// this form has no business resetting it.
					unitOfMeasure: unitOfMeasurement === 'other' ? otherUnitOfMeasurement : unitOfMeasurement,
					reorderLevel,
					returnable,
					updatedBy: locals?.user?.id
				})
				.where(eq(supplies.id, Number(id)));

			// Stay on the same page and set a flash message
			return message(form, { type: 'success', text: 'Supply updated successfully' });
		} catch (err) {
			console.error(err?.message);
			return message(form, { type: `error', text: 'Unexpected Error: ${err?.message}` });
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

		const { intent, quantity, costPerItem, reason, reciept, bank, acknowledgeOverdraft } =
			form.data;

		if (!id) {
			return message(form, { type: 'error', text: 'Unexpected Error: Supply ID not provided' });
		}

		const adjustment = intent === 'add' ? Number(quantity) : -Number(quantity);
		const total = adjustment * Number(costPerItem ?? 0);

		// Buying stock spends money, so it has to come out of a named account.
		// Removing stock costs nothing, which is why this is only required here.
		if (total > 0 && !bank) {
			return setError(form, 'bank', 'Choose the account this was paid from');
		}

		if (total > 0 && bank) {
			const check = await overdraftCheck(bank, -total);
			if (!check) {
				return setError(form, 'bank', 'That account no longer exists');
			}
			if (check.overdraws && !acknowledgeOverdraft) {
				return message(form, { type: 'error', text: overdraftMessage(check) }, { status: 400 });
			}
		}

		try {
			await db.transaction(async (tx) => {
				let transactionId: number | null = null;

				if (total > 0 && bank) {
					const recieptLink = reciept ? await saveUploadedFile(reciept) : null;

					const [created] = await tx
						.insert(transactions)
						.values({
							amount: String(-Math.abs(total)),
							paymentMethodId: await paymentMethodForBank(tx, bank),
							recieptLink,
							description: `Stock purchase${reason ? ': ' + reason : ''}`,
							paymentStatus: 'paid',
							createdBy: locals.user?.id
						})
						.$returningId();

					transactionId = created.id;

					await tx.insert(transactionSupplies).values({
						transactionId: created.id,
						supplyId: id,
						quantity: String(adjustment),
						unitPrice: String(costPerItem ?? 0)
					});

					await postToBank(tx, {
						bankAmountId: bank,
						transactionId: created.id,
						amount: -Math.abs(total),
						reason: 'Stock purchase',
						userId: locals.user?.id
					});
				}

				await tx.insert(suppliesAdjustments).values({
					suppliesId: id,
					adjustment,
					costPerItem: costPerItem ? String(costPerItem) : null,
					total: total ? String(total) : null,
					reason,
					transactionId,
					createdBy: locals.user?.id
				});

				await tx
					.update(supplies)
					.set({
						quantity: sql`${supplies.quantity} + ${adjustment}`,
						updatedBy: locals.user?.id
					})
					.where(eq(supplies.id, id));
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
	damaged: async ({ params, locals, request }) => {
		const { id } = params;
		const form = await superValidate(request, zod4(damagedSchema));

		const { quantity, damagedBy, deductable, reason } = form.data;

		try {
			if (!id) {
				return message(form, { type: 'error', text: 'Unexpected Error: Supply ID not provided' });
			}

			await db.update(damagedSupplies).set({
				supplyId: Number(id),
				quantity: Number(quantity),
				createdBy: locals.user?.id,
				damagedBy: Number(damagedBy),
				deductable,
				reason
			});

			await db
				.update(supplies)
				.set({
					quantity: sql`quantity - ${Number(quantity)}`,
					updatedBy: locals.user?.id
				})
				.where(eq(supplies.id, Number(id)));
			if (deductable) {
				const cost = await db
					.select({
						costPerItem: suppliesAdjustments.costPerItem
					})
					.from(suppliesAdjustments)
					.where(
						and(
							eq(suppliesAdjustments.suppliesId, Number(id)),
							isNotNull(suppliesAdjustments.costPerItem), // Ensures we get a record with a price
							notDeleted(suppliesAdjustments)
						)
					)
					.orderBy(desc(suppliesAdjustments.createdAt))
					.then((rows) => rows[0]);

				await db.insert(deductions).values({
					staffId: Number(damagedBy),
					type: 'Damaged Supply Item',
					createdBy: locals.user?.id,
					amount: Number(quantity) * Number(cost?.costPerItem),
					reason
				});
			}

			return message(form, { type: 'success', text: 'Damaged supply added Successfully!' });
		} catch (err) {
			console.error('Error marking adding damaged supply:', err);
			return message(form, { type: 'error', text: `Unexpected Error: ${err?.message}` });
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
