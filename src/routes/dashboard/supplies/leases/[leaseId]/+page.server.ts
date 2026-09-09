import { superValidate, message } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { error, fail } from '@sveltejs/kit';
import { setFlash, redirect } from 'sveltekit-flash-message/server';

import {
	approveSchema,
	cancelSchema,
	closeSchema,
	issueSchema,
	rejectSchema,
	returnSchema
} from './schema';

import { db } from '$lib/server/db';
import {
	site,
	supplies,
	supplyLeaseEvents,
	supplyLeaseItems,
	supplyLeaseMovements,
	supplyLeases,
	user
} from '$lib/server/db/schema';
import { aliasedTable, and, asc, desc, eq, sql } from 'drizzle-orm';
import { notDeleted, softDeleteLease } from '$lib/server/softDelete';
import { requireSuperAdmin } from '$lib/server/permissions';
import {
	canTransition,
	issueLeaseItems,
	loadLeaseForUpdate,
	logLeaseEvent,
	outstandingOnLease,
	returnLeaseItems,
	type LeaseStatus
} from '$lib/server/supplyLeaseFlow';
import { stockBySupply, stockFor } from '$lib/server/supplyStock';
import type { Actions, PageServerLoad } from './$types';

// Attribution joins need one alias per actor — the same `user` table shows up
// five times on this page and drizzle needs them told apart.
const requester = aliasedTable(user, 'requester');
const approver = aliasedTable(user, 'approver');
const issuer = aliasedTable(user, 'issuer');
const rejecter = aliasedTable(user, 'rejecter');
const canceller = aliasedTable(user, 'canceller');
const closer = aliasedTable(user, 'closer');

export const load: PageServerLoad = async ({ params }) => {
	const leaseId = Number(params.leaseId);

	if (!Number.isFinite(leaseId)) throw error(404, 'Lease not found.');

	const lease = await db
		.select({
			id: supplyLeases.id,
			referenceNumber: supplyLeases.referenceNumber,
			siteId: supplyLeases.siteId,
			site: site.name,
			sitePhone: site.phone,
			status: supplyLeases.status,
			reason: supplyLeases.reason,
			documentFile: supplyLeases.documentFile,
			// Raw dates throughout: the page renders them with `formatEthiopianDate`.
			expectedReturnDate: supplyLeases.expectedReturnDate,
			// Each actor carries an id as well as a name so the audit trail can
			// link through to their page in the admin panel.
			requestedBy: requester.name,
			requestedById: sql<
				string | null
			>`CASE WHEN ${requester.deletedAt} IS NULL THEN ${requester.id} END`,
			requestedAt: supplyLeases.requestedAt,
			approvedBy: approver.name,
			approvedById: sql<
				string | null
			>`CASE WHEN ${approver.deletedAt} IS NULL THEN ${approver.id} END`,
			approvedAt: supplyLeases.approvedAt,
			approvalNote: supplyLeases.approvalNote,
			rejectedBy: rejecter.name,
			rejectedById: sql<
				string | null
			>`CASE WHEN ${rejecter.deletedAt} IS NULL THEN ${rejecter.id} END`,
			rejectedAt: supplyLeases.rejectedAt,
			rejectedReason: supplyLeases.rejectedReason,
			cancelledBy: canceller.name,
			cancelledById: sql<
				string | null
			>`CASE WHEN ${canceller.deletedAt} IS NULL THEN ${canceller.id} END`,
			cancelledAt: supplyLeases.cancelledAt,
			cancellationReason: supplyLeases.cancellationReason,
			issuedBy: issuer.name,
			issuedById: sql<string | null>`CASE WHEN ${issuer.deletedAt} IS NULL THEN ${issuer.id} END`,
			issuedAt: supplyLeases.issuedAt,
			receivedByName: supplyLeases.receivedByName,
			receivedByPhone: supplyLeases.receivedByPhone,
			closedBy: closer.name,
			closedById: sql<string | null>`CASE WHEN ${closer.deletedAt} IS NULL THEN ${closer.id} END`,
			closedAt: supplyLeases.closedAt
		})
		.from(supplyLeases)
		.leftJoin(site, and(eq(supplyLeases.siteId, site.id), notDeleted(site)))
		// Actor joins are never filtered by `notDeleted`: a deleted user still
		// did what they did, and hiding the name would blank the audit trail.
		.leftJoin(requester, eq(supplyLeases.requestedBy, requester.id))
		.leftJoin(approver, eq(supplyLeases.approvedBy, approver.id))
		.leftJoin(rejecter, eq(supplyLeases.rejectedBy, rejecter.id))
		.leftJoin(canceller, eq(supplyLeases.cancelledBy, canceller.id))
		.leftJoin(issuer, eq(supplyLeases.issuedBy, issuer.id))
		.leftJoin(closer, eq(supplyLeases.closedBy, closer.id))
		.where(and(eq(supplyLeases.id, leaseId), notDeleted(supplyLeases)))
		.then((rows) => rows[0]);

	if (!lease) {
		throw error(404, 'Lease not found — it has been deleted or never existed.');
	}

	const itemRows = await db
		.select({
			id: supplyLeaseItems.id,
			supplyId: supplyLeaseItems.supplyId,
			name: supplies.name,
			unitOfMeasure: supplies.unitOfMeasure,
			onHand: supplies.quantity,
			quantityRequested: supplyLeaseItems.quantityRequested,
			quantityApproved: supplyLeaseItems.quantityApproved,
			quantityIssued: supplyLeaseItems.quantityIssued,
			quantityReturned: supplyLeaseItems.quantityReturned,
			quantityWrittenOff: supplyLeaseItems.quantityWrittenOff,
			returnable: supplyLeaseItems.returnable,
			unitCost: supplyLeaseItems.unitCost,
			notes: supplyLeaseItems.notes
		})
		.from(supplyLeaseItems)
		.innerJoin(supplies, eq(supplies.id, supplyLeaseItems.supplyId))
		.where(and(eq(supplyLeaseItems.leaseId, leaseId), notDeleted(supplyLeaseItems)))
		.orderBy(asc(supplyLeaseItems.id));

	const stock = await stockBySupply(itemRows.map((row) => row.supplyId));

	const items = itemRows.map((row) => {
		const figures = stockFor(row.supplyId, row.onHand, stock);
		return {
			...row,
			/** Approved but not yet handed over — what this hand-over may still move. */
			awaitingIssue: Math.max(row.quantityApproved - row.quantityIssued, 0),
			/** Out at the site and still owed back. Consumables never owe anything. */
			outstanding: row.returnable
				? Math.max(row.quantityIssued - row.quantityReturned - row.quantityWrittenOff, 0)
				: 0,
			available: figures.available,
			storeOnHand: figures.onHand
		};
	});

	const movements = await db
		.select({
			id: supplyLeaseMovements.id,
			item: supplies.name,
			movementType: supplyLeaseMovements.movementType,
			quantity: supplyLeaseMovements.quantity,
			condition: supplyLeaseMovements.condition,
			reason: supplyLeaseMovements.reason,
			performedBy: user.name,
			performedById: sql<string | null>`CASE WHEN ${user.deletedAt} IS NULL THEN ${user.id} END`,
			performedAt: supplyLeaseMovements.performedAt
		})
		.from(supplyLeaseMovements)
		.innerJoin(supplyLeaseItems, eq(supplyLeaseItems.id, supplyLeaseMovements.leaseItemId))
		.innerJoin(supplies, eq(supplies.id, supplyLeaseItems.supplyId))
		.leftJoin(user, eq(supplyLeaseMovements.performedBy, user.id))
		.where(and(eq(supplyLeaseItems.leaseId, leaseId), notDeleted(supplyLeaseMovements)))
		.orderBy(desc(supplyLeaseMovements.performedAt), desc(supplyLeaseMovements.id));

	const events = await db
		.select({
			id: supplyLeaseEvents.id,
			fromStatus: supplyLeaseEvents.fromStatus,
			toStatus: supplyLeaseEvents.toStatus,
			note: supplyLeaseEvents.note,
			actedBy: user.name,
			actedById: sql<string | null>`CASE WHEN ${user.deletedAt} IS NULL THEN ${user.id} END`,
			actedAt: supplyLeaseEvents.actedAt
		})
		.from(supplyLeaseEvents)
		.leftJoin(user, eq(supplyLeaseEvents.actedBy, user.id))
		.where(and(eq(supplyLeaseEvents.leaseId, leaseId), notDeleted(supplyLeaseEvents)))
		.orderBy(desc(supplyLeaseEvents.actedAt), desc(supplyLeaseEvents.id));

	return {
		lease,
		items,
		movements,
		events,
		outstanding: items.reduce((total, item) => total + item.outstanding, 0),
		// Explicit ids: superforms derives one from the schema shape, and
		// reject/cancel are identical schemas, so both forms would answer to the
		// same id and cross-populate each other on a pending lease where both
		// buttons are shown.
		approveForm: await superValidate(zod4(approveSchema), { id: 'approve' }),
		rejectForm: await superValidate(zod4(rejectSchema), { id: 'reject' }),
		cancelForm: await superValidate(zod4(cancelSchema), { id: 'cancel' }),
		issueForm: await superValidate(zod4(issueSchema), { id: 'issue' }),
		returnForm: await superValidate(zod4(returnSchema), { id: 'return' }),
		closeForm: await superValidate(zod4(closeSchema), { id: 'close' })
	};
};

/** Shared preamble: valid session, lease exists, and the move is legal. */
async function guard(locals: App.Locals, leaseId: number, to: LeaseStatus) {
	const userId = locals.user?.id;
	if (!userId) return { error: 'Your session has expired. Sign in again.' as const };

	const lease = await loadLeaseForUpdate(db, leaseId);
	if (!lease) return { error: 'That lease no longer exists.' as const };

	if (!canTransition(lease.status, to)) {
		return {
			error:
				`A ${lease.status.replace('_', ' ')} lease cannot be moved to ${to.replace('_', ' ')}.` as const
		};
	}

	return { userId, lease };
}

export const actions: Actions = {
	approve: async ({ request, params, locals }) => {
		const leaseId = Number(params.leaseId);
		const form = await superValidate(request, zod4(approveSchema), { id: 'approve' });
		if (!form.valid) return message(form, { type: 'error', text: 'Check the quantities.' });

		const check = await guard(locals, leaseId, 'approved');
		if ('error' in check) return message(form, { type: 'error', text: check.error });
		const { userId, lease } = check;

		try {
			await db.transaction(async (tx) => {
				const rows = await tx
					.select({
						id: supplyLeaseItems.id,
						supplyId: supplyLeaseItems.supplyId,
						name: supplies.name,
						onHand: supplies.quantity,
						quantityRequested: supplyLeaseItems.quantityRequested
					})
					.from(supplyLeaseItems)
					.innerJoin(supplies, eq(supplies.id, supplyLeaseItems.supplyId))
					.where(and(eq(supplyLeaseItems.leaseId, leaseId), notDeleted(supplyLeaseItems)));

				const byId = new Map(rows.map((row) => [row.id, row]));
				const stock = await stockBySupply(rows.map((row) => row.supplyId));

				for (const line of form.data.items) {
					const item = byId.get(line.itemId);
					// The item id comes from the client, so it is re-checked against
					// this lease's own lines rather than trusted as a primary key.
					if (!item) throw new Error('That item does not belong to this lease.');

					if (line.quantity > item.quantityRequested) {
						throw new Error(
							`Cannot approve ${line.quantity} ${item.name} — only ${item.quantityRequested} were requested.`
						);
					}

					const { available } = stockFor(item.supplyId, item.onHand, stock);
					if (line.quantity > available) {
						throw new Error(
							`Cannot approve ${line.quantity} ${item.name} — only ${available} are free to claim.`
						);
					}

					await tx
						.update(supplyLeaseItems)
						.set({ quantityApproved: line.quantity, updatedBy: userId })
						.where(eq(supplyLeaseItems.id, item.id));
				}

				await tx
					.update(supplyLeases)
					.set({
						status: 'approved',
						approvedBy: userId,
						approvedAt: sql`NOW()`,
						approvalNote: form.data.note?.trim() || null,
						updatedBy: userId
					})
					.where(eq(supplyLeases.id, leaseId));

				await logLeaseEvent(tx, {
					leaseId,
					fromStatus: lease.status,
					toStatus: 'approved',
					actedBy: userId,
					note: form.data.note?.trim() || null
				});
			});

			return message(form, { type: 'success', text: 'Lease approved. It can now be issued.' });
		} catch (err) {
			console.error('Error approving lease:', err);
			return message(form, {
				type: 'error',
				text: err instanceof Error ? err.message : 'Unknown error approving the lease.'
			});
		}
	},

	reject: async ({ request, params, locals }) => {
		const leaseId = Number(params.leaseId);
		const form = await superValidate(request, zod4(rejectSchema), { id: 'reject' });
		if (!form.valid) return message(form, { type: 'error', text: 'A reason is required.' });

		const check = await guard(locals, leaseId, 'rejected');
		if ('error' in check) return message(form, { type: 'error', text: check.error });
		const { userId, lease } = check;

		try {
			await db.transaction(async (tx) => {
				await tx
					.update(supplyLeases)
					.set({
						status: 'rejected',
						rejectedBy: userId,
						rejectedAt: sql`NOW()`,
						rejectedReason: form.data.reason,
						updatedBy: userId
					})
					.where(eq(supplyLeases.id, leaseId));

				await logLeaseEvent(tx, {
					leaseId,
					fromStatus: lease.status,
					toStatus: 'rejected',
					actedBy: userId,
					note: form.data.reason
				});
			});

			return message(form, { type: 'success', text: 'Lease request rejected.' });
		} catch (err) {
			console.error('Error rejecting lease:', err);
			return message(form, { type: 'error', text: 'Could not reject the lease.' });
		}
	},

	cancel: async ({ request, params, locals }) => {
		const leaseId = Number(params.leaseId);
		const form = await superValidate(request, zod4(cancelSchema), { id: 'cancel' });
		if (!form.valid) return message(form, { type: 'error', text: 'A reason is required.' });

		const check = await guard(locals, leaseId, 'cancelled');
		if ('error' in check) return message(form, { type: 'error', text: check.error });
		const { userId, lease } = check;

		try {
			await db.transaction(async (tx) => {
				await tx
					.update(supplyLeases)
					.set({
						status: 'cancelled',
						cancelledBy: userId,
						cancelledAt: sql`NOW()`,
						cancellationReason: form.data.reason,
						updatedBy: userId
					})
					.where(eq(supplyLeases.id, leaseId));

				await logLeaseEvent(tx, {
					leaseId,
					fromStatus: lease.status,
					toStatus: 'cancelled',
					actedBy: userId,
					note: form.data.reason
				});
			});

			// Cancelling releases the reserved stock, because `stockBySupply` only
			// counts leases that are still approved or out.
			return message(form, { type: 'success', text: 'Lease cancelled and its stock released.' });
		} catch (err) {
			console.error('Error cancelling lease:', err);
			return message(form, { type: 'error', text: 'Could not cancel the lease.' });
		}
	},

	issue: async ({ request, params, locals }) => {
		const leaseId = Number(params.leaseId);
		const form = await superValidate(request, zod4(issueSchema), { id: 'issue' });
		if (!form.valid) return message(form, { type: 'error', text: 'Check the quantities.' });

		const check = await guard(locals, leaseId, 'issued');
		if ('error' in check) return message(form, { type: 'error', text: check.error });
		const { userId } = check;

		try {
			const { issued } = await db.transaction((tx) =>
				issueLeaseItems(tx, {
					leaseId,
					lines: form.data.items.filter((line) => line.quantity > 0),
					userId,
					receivedByName: form.data.receivedByName,
					receivedByPhone: form.data.receivedByPhone,
					note: form.data.note?.trim() || null
				})
			);

			return message(form, {
				type: 'success',
				text: `${issued} unit(s) issued and taken out of store stock.`
			});
		} catch (err) {
			console.error('Error issuing lease:', err);
			return message(form, {
				type: 'error',
				text: err instanceof Error ? err.message : 'Unknown error issuing the lease.'
			});
		}
	},

	return: async ({ request, params, locals }) => {
		const leaseId = Number(params.leaseId);
		const form = await superValidate(request, zod4(returnSchema), { id: 'return' });
		if (!form.valid) return message(form, { type: 'error', text: 'Check the quantities.' });

		// Either target is legal from `issued`/`partially_returned`; which one it
		// lands on depends on what is still outstanding after the batch.
		const check = await guard(locals, leaseId, 'partially_returned');
		if ('error' in check) return message(form, { type: 'error', text: check.error });
		const { userId } = check;

		try {
			const result = await db.transaction((tx) =>
				returnLeaseItems(tx, {
					leaseId,
					lines: form.data.items.filter((line) => line.quantity > 0),
					userId,
					reason: form.data.reason?.trim() || null
				})
			);

			const parts = [`${result.returned} returned to store`];
			if (result.writtenOff) parts.push(`${result.writtenOff} written off`);

			return message(form, {
				type: 'success',
				text: `${parts.join(', ')}. Lease is now ${result.status.replace('_', ' ')}.`
			});
		} catch (err) {
			console.error('Error returning lease items:', err);
			return message(form, {
				type: 'error',
				text: err instanceof Error ? err.message : 'Unknown error recording the return.'
			});
		}
	},

	close: async ({ request, params, locals }) => {
		const leaseId = Number(params.leaseId);
		const form = await superValidate(request, zod4(closeSchema), { id: 'close' });
		if (!form.valid) return message(form, { type: 'error', text: 'Check the form.' });

		const check = await guard(locals, leaseId, 'closed');
		if ('error' in check) return message(form, { type: 'error', text: check.error });
		const { userId, lease } = check;

		try {
			const outstanding = await outstandingOnLease(db, leaseId);
			if (outstanding > 0) {
				return message(form, {
					type: 'error',
					text: `${outstanding} unit(s) are still out at the site. Record the return first, or write them off.`
				});
			}

			await db.transaction(async (tx) => {
				await tx
					.update(supplyLeases)
					.set({
						status: 'closed',
						closedBy: userId,
						closedAt: sql`NOW()`,
						updatedBy: userId
					})
					.where(eq(supplyLeases.id, leaseId));

				await logLeaseEvent(tx, {
					leaseId,
					fromStatus: lease.status,
					toStatus: 'closed',
					actedBy: userId,
					note: form.data.note?.trim() || null
				});
			});

			return message(form, { type: 'success', text: 'Lease closed.' });
		} catch (err) {
			console.error('Error closing lease:', err);
			return message(form, { type: 'error', text: 'Could not close the lease.' });
		}
	},

	/**
	 * Soft delete. Super admin only — `requireSuperAdmin` throws 403 rather than
	 * failing quietly, because hiding the button is UX, not access control.
	 *
	 * `softDeleteLease` refuses once stock has moved; see its comment for why a
	 * lease that reached `issued` has to be returned and closed instead.
	 */
	delete: async ({ cookies, params, locals }) => {
		requireSuperAdmin(locals);
		const leaseId = Number(params.leaseId);

		if (!Number.isFinite(leaseId)) {
			setFlash({ type: 'error', message: 'Unexpected Error: missing lease id' }, cookies);
			return fail(400);
		}

		try {
			const result = await db.transaction((tx) => softDeleteLease(tx, leaseId, locals.user?.id));

			if (!result.ok) {
				setFlash(
					{ type: 'error', message: result.reason ?? 'Could not delete the lease.' },
					cookies
				);
				return fail(400);
			}
		} catch (err) {
			console.error('Error deleting lease:', err);
			setFlash(
				{
					type: 'error',
					message: `Could not delete lease: ${err instanceof Error ? err.message : 'Unknown error'}`
				},
				cookies
			);
			return fail(500);
		}

		redirect(
			'/dashboard/supplies/leases',
			{ type: 'success', message: 'Lease request deleted.' },
			cookies
		);
	}
};
