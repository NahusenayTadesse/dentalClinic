import { db } from '$lib/server/db';
import { leave, leaveType, employee, department, site, user } from '$lib/server/db/schema';

import { eq, and, desc, sql, inArray } from 'drizzle-orm';
import { notDeleted, softDeleteLookup } from '$lib/server/softDelete';
import { requireSuperAdmin } from '$lib/server/permissions';
import { setFlash } from 'sveltekit-flash-message/server';
import type { PageServerLoad, Actions } from './$types';
import { superValidate } from 'sveltekit-superforms';
import { leaveTypes } from '$lib/server/fastData';
import { fail, message, setError } from 'sveltekit-superforms';
import { computeLeaveDays } from '$lib/leaveDays';
import {
	readLeaveStates,
	settleLeaveBatch,
	settleLeaveDeletion,
	settleLeaveEdit
} from '$lib/server/leaveLedger';
import { leaveAllowanceError } from '$lib/server/leaveAllowance';
import { zod4 } from 'sveltekit-superforms/adapters';
import { approveLeaveFor, editLeave } from '$lib/components/leaves/schema';

/** This page lists 'rejected' leaves, so the bulk action offers the other two states. */
const approveLeave = approveLeaveFor('rejected');

export const load: PageServerLoad = async () => {
	const form = await superValidate(zod4(approveLeave));
	const leaves = await db
		.select({
			id: leave.id,
			staffId: leave.staffId,
			name: employeeFullName,
			department: department.name,
			siteName: site.name,
			requestDate: leave.requestDate,
			startDate: leave.startDate,
			endDate: leave.endDate,
			leaveTypeId: leave.leaveTypeId,
			leaveTypeName: leaveType.name,
			reason: leave.reason,
			leaveLetter: leave.leaveLetter,
			rejectionReason: leave.rejectionReason,
			approvedBy: user.name,
			approvedById: user.id,
			status: leave.status,
			halfDayStart: leave.halfDayStart,
			halfDayEnd: leave.halfDayEnd,
			// The stored duration, which is the only place the half-day flags are accounted for.
			numberOfDays: leave.days
		})
		.from(leave)
		.leftJoin(leaveType, and(eq(leave.leaveTypeId, leaveType.id), notDeleted(leaveType)))
		.leftJoin(employee, and(eq(leave.staffId, employee.id), notDeleted(employee)))
		.leftJoin(department, and(eq(employee.departmentId, department.id), notDeleted(department)))
		.leftJoin(site, and(eq(employee.siteId, site.id), notDeleted(site)))
		.leftJoin(user, eq(leave.approvedBy, user.id))
		.where(and(eq(leave.status, 'rejected'), notDeleted(leave)));

	const leaveTypeList = await leaveTypes();

	const salaryHistory = await Promise.all(
		leaves.map(async (leave) => {
			return {
				...leave,
				leaveTypeList,
				form: await superValidate(zod4(editLeave))
			};
		})
	);

	return {
		salaryHistory,
		form
	};
};

import { saveUploadedFile } from '$lib/server/upload';
import { employeeFullName } from '$lib/server/employeeName';

export const actions: Actions = {
	approve: async ({ request, locals, params }) => {
		const form = await superValidate(request, zod4(approveLeave));

		if (!form.valid) {
			return message(form, { type: 'error', text: `Error: check the form` });
		}

		const { ids, status } = form.data;

		// Days approved beyond what the employee had accrued, reported back to the approver.
		let overBooked = 0;

		try {
			await db.transaction(async (tx) => {
				// Read before the update: settling needs what these leaves cost the balance until now.
				const before = await readLeaveStates(tx, ids);

				if (before.length === 0) return;

				// The approver stamp only belongs on an approval; any other move is an edit.
				await tx
					.update(leave)
					.set(
						status === 'approved'
							? { status, approvedBy: locals?.user?.id }
							: { status, updatedBy: locals?.user?.id }
					)
					.where(and(inArray(leave.id, ids), notDeleted(leave)));

				// Settling the difference rather than the destination is what keeps a re-submitted
				// batch from charging twice, and what refunds a leave that leaves 'approved'.
				overBooked = await settleLeaveBatch(tx, before, status);
			});

			const overBookedNote =
				overBooked > 0
					? ` Note: ${overBooked} day${overBooked === 1 ? '' : 's'} exceeded the accrued balance.`
					: '';

			return message(form, {
				type: overBooked > 0 ? 'error' : 'success',
				text:
					`Leave Status changed to ${status === 'pending' ? 'Pending' : 'Approved'} Successfully!` +
					overBookedNote
			});
		} catch (err) {
			console.error(err?.message);
			return message(form, {
				type: 'error',
				text: `Updating Leave failed: ${err instanceof Error ? err.message : 'Unknown error'}`
			});
		}
	},
	editLeave: async ({ request, locals }) => {
		const form = await superValidate(request, zod4(editLeave));

		if (!form.valid) {
			// Stay on the same page and set a flash message
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
		if (overAllowance) {
			return setError(form, 'leaveType', overAllowance);
		}

		try {
			await db.transaction(async (tx) => {
				// The ledger is settled against this, so it has to be read before anything is written.
				const [before] = await readLeaveStates(tx, [id]);
				if (!before) return;

				if (leaveLetter) {
					const leaveLetterFile = await saveUploadedFile(leaveLetter);
					await tx
						.update(leave)
						.set({
							leaveLetter: leaveLetterFile
						})
						.where(eq(leave.id, id));
				}

				// Set unconditionally: guarding on a truthy value made an empty box impossible to
				// save, and left a stale reason behind on a leave that is no longer rejected.
				await tx
					.update(leave)
					.set({ rejectionReason: status === 'rejected' ? (rejectionReason ?? null) : null })
					.where(eq(leave.id, id));
				await tx
					.update(leave)
					.set({
						leaveTypeId,
						requestDate,
						startDate,
						endDate,
						halfDayStart,
						halfDayEnd,
						days,
						reason,
						status
					})
					.where(eq(leave.id, id));

				// Settle against what this leave cost before the edit, so re-saving an approved leave
				// is a no-op and a changed duration, type or status moves the balance by the
				// difference rather than charging afresh.
				await settleLeaveEdit(tx, before, { status, leaveTypeId, days });
			});

			return message(form, { type: 'success', text: 'Leave Updated successfully' });
			// Stay on the same page and set a flash message
			// setFlash({ type: 'success', message: 'Customer Successfully Added' }, cookies);
		} catch (err) {
			console.error('Error' + err?.message);

			return message(form, {
				type: 'error',
				text: `Unexpected Errror: ${err?.message}`
			});
		}
	},

	/**
	 * Soft delete of one leave request. Super admin only — `requireSuperAdmin`
	 * throws 403 rather than failing quietly, because the hidden button is UX,
	 * not access control.
	 *
	 * Deleting refunds: a leave that no longer exists cannot go on costing days, so anything
	 * an approved leave had taken off the balance is returned as part of the same transaction.
	 */
	delete: async ({ request, locals, cookies }) => {
		requireSuperAdmin(locals);

		const data = await request.formData();
		const leaveId = Number(data.get('id'));

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
		} catch (err) {
			console.error('Error deleting leave request:', err);
			setFlash(
				{
					type: 'error',
					message: `Could not delete leave request: ${err instanceof Error ? err.message : 'Unknown error'}`
				},
				cookies
			);
			return fail(500);
		}

		setFlash({ type: 'success', message: 'Leave request deleted.' }, cookies);
		return { success: true };
	}
};
