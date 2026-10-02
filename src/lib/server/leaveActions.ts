import type { RequestEvent } from '@sveltejs/kit';
import { and, eq, inArray } from 'drizzle-orm';
import { fail, message, setError, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { setFlash } from 'sveltekit-flash-message/server';
import { db } from '$lib/server/db';
import { leave } from '$lib/server/db/schema';
import { notDeleted, softDeleteLookup } from '$lib/server/softDelete';
import { requireSuperAdmin } from '$lib/server/permissions';
import { saveUploadedFile } from '$lib/server/files';
import { computeLeaveDays } from '$lib/leaveDays';
import {
	readLeaveStates,
	settleLeaveBatch,
	settleLeaveDeletion,
	settleLeaveEdit
} from '$lib/server/leaveLedger';
import { leaveAllowanceError } from '$lib/server/leaveAllowance';
import { approveLeaveFor, editLeave, type LeaveStatus } from '$lib/components/leaves/schema';

/**
 * The three things a leave list does to its rows — move a batch to another state, edit one, delete
 * one — for every leave list at once.
 *
 * The pending, approved and rejected pages each carried a copy of these, and they had drifted the
 * way CLAUDE.md §2 says copies do: the rejected page announced a move to "Approved" for a move to
 * "Pending", the pending page saved dates as strings the approved page converted, and only the
 * approved page had stopped leaking database errors to the screen. One copy now, told which state
 * its page lists.
 *
 * Non-goal: the lists themselves. Their loads differ (the approved page pages on the server; the
 * other two are short enough to load whole), so each page keeps its own `load`.
 */

const STATUS_LABEL: Record<LeaveStatus, string> = {
	pending: 'Pending',
	approved: 'Approved',
	rejected: 'Rejected'
};

/** The `approve`, `editLeave` and `delete` actions for the page that lists `current` leaves. */
export function leaveActions(current: LeaveStatus) {
	const moveSchema = approveLeaveFor(current);

	return {
		/** Moves the ticked leaves to another state, settling the leave balance by the difference. */
		approve: async ({ request, locals }: RequestEvent) => {
			const form = await superValidate(request, zod4(moveSchema));
			if (!form.valid) {
				return message(form, { type: 'error', text: 'Please check the form' });
			}
			const { ids, status } = form.data;

			// Days approved beyond what the employee had accrued, reported back to the approver.
			let overBooked = 0;
			try {
				await db.transaction(async (tx) => {
					// Read before the update: settling needs what these leaves cost the balance until now.
					const before = await readLeaveStates(tx, ids);
					if (before.length === 0) return;

					// The approver stamp belongs on an approval only. Any other move is an edit — stamping
					// `approvedBy` on the way out of 'approved' overwrote who had approved it.
					await tx
						.update(leave)
						.set(
							status === 'approved'
								? { status, approvedBy: locals.user?.id }
								: { status, updatedBy: locals.user?.id }
						)
						.where(and(inArray(leave.id, ids), notDeleted(leave)));

					// Settling the difference rather than the destination is what keeps a re-submitted
					// batch from charging twice, and what refunds a leave that leaves 'approved'.
					overBooked = await settleLeaveBatch(tx, before, status);
				});
			} catch (err: unknown) {
				// Loud in the log, quiet to the client (CLAUDE.md §9).
				console.error('leave status change failed', err);
				return message(form, { type: 'error', text: 'The leave status could not be changed' });
			}

			const note =
				overBooked > 0
					? ` Note: ${overBooked} day${overBooked === 1 ? '' : 's'} exceeded the accrued balance.`
					: '';
			return message(form, {
				type: overBooked > 0 ? 'error' : 'success',
				text: `Leave status changed to ${STATUS_LABEL[status]}.${note}`
			});
		},

		/** Changes one leave, recomputing its days and settling the balance against the old ones. */
		editLeave: async ({ request }: RequestEvent) => {
			const form = await superValidate(request, zod4(editLeave));
			if (!form.valid) {
				return message(form, { type: 'error', text: 'Please check your form.' });
			}
			const {
				id,
				leaveType: leaveTypeId,
				requestDate,
				startDate,
				endDate,
				halfDayStart,
				halfDayEnd,
				leaveLetter,
				reason,
				status,
				rejectionReason
			} = form.data;

			// Dates and half-day flags can both change here, so the stored duration is recomputed
			// rather than left stale — it is what the ledger spends.
			const days = computeLeaveDays({ startDate, endDate, halfDayStart, halfDayEnd });
			if (days <= 0) {
				return setError(form, 'endDate', 'The end date cannot be before the start date.');
			}

			// The allowance shown against each type is a real limit, not a label.
			const overAllowance = await leaveAllowanceError(db, leaveTypeId, days);
			if (overAllowance) return setError(form, 'leaveType', overAllowance);

			try {
				await db.transaction(async (tx) => {
					// The ledger is settled against this, so it has to be read before anything is written.
					const [before] = await readLeaveStates(tx, [id]);
					if (!before) return;

					const letter = leaveLetter ? await saveUploadedFile(leaveLetter) : undefined;
					await tx
						.update(leave)
						.set({
							leaveTypeId,
							requestDate: new Date(requestDate),
							startDate: new Date(startDate),
							endDate: new Date(endDate),
							halfDayStart,
							halfDayEnd,
							days,
							reason,
							status,
							// Set unconditionally: guarding on a truthy value made an empty box impossible to
							// save, and left a stale reason behind on a leave that is no longer rejected.
							rejectionReason: status === 'rejected' ? (rejectionReason ?? null) : null,
							...(letter ? { leaveLetter: letter } : {})
						})
						.where(eq(leave.id, id));

					// Settle against what this leave cost before the edit, so re-saving an approved leave
					// is a no-op and a changed duration, type or status moves the balance by the
					// difference rather than charging afresh.
					await settleLeaveEdit(tx, before, { status, leaveTypeId, days });
				});
			} catch (err: unknown) {
				console.error('leave edit failed', err);
				return message(form, { type: 'error', text: 'The leave could not be saved' });
			}
			return message(form, { type: 'success', text: 'Leave saved' });
		},

		/**
		 * Soft delete of one leave request. Super admin only — `requireSuperAdmin` throws 403 rather
		 * than failing quietly, because the hidden button is UX, not access control.
		 *
		 * Deleting refunds: a leave that no longer exists cannot go on costing days, so anything an
		 * approved leave had taken off the balance is returned in the same transaction.
		 */
		delete: async ({ request, locals, cookies }: RequestEvent) => {
			requireSuperAdmin(locals);

			const leaveId = Number((await request.formData()).get('id'));
			if (!leaveId) {
				setFlash({ type: 'error', message: 'No leave request was selected.' }, cookies);
				return fail(400);
			}

			try {
				const deleted = await db.transaction(async (tx) => {
					// Read first: once the row is stamped deleted, readLeaveStates will not see it.
					const [before] = await readLeaveStates(tx, [leaveId]);
					const removed = await softDeleteLookup(tx, leave, leaveId, locals.user?.id);
					if (!removed) return false;
					if (before) await settleLeaveDeletion(tx, before);
					return true;
				});
				if (!deleted) {
					setFlash({ type: 'error', message: 'That leave request was not found.' }, cookies);
					return fail(404);
				}
			} catch (err: unknown) {
				console.error('leave delete failed', err);
				setFlash({ type: 'error', message: 'The leave request could not be deleted.' }, cookies);
				return fail(500);
			}

			setFlash({ type: 'success', message: 'Leave request deleted.' }, cookies);
			return { success: true };
		}
	};
}
