import { db } from '$lib/server/db';
import { leave, leaveType, employee, department, site, user } from '$lib/server/db/schema';

import { eq, and, or, like, gt, lte, desc, sql, inArray, count } from 'drizzle-orm';
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
import { parseTableQuery, buildWhere, pagination, currentQuery } from '$lib/server/queryFilters';
import { approveLeave, editLeave } from './schema';

/**
 * Approved leaves, most recent first.
 *
 * Approved leaves are never cleared out, so this page grew without bound: it loaded
 * every approved leave the company has ever granted and handed the whole set to a
 * client-side `FilterMenu`, which could only narrow rows already in the browser. It
 * now runs on the shared server-side query bar — one page at a time, and the filters
 * reach the whole table rather than the current screenful.
 */
export const load: PageServerLoad = async ({ url }) => {
	const query = parseTableQuery(
		url,
		['leaveTypeId', 'departmentId', 'siteId', 'approvedById', 'duration'],
		20
	);

	const whereClause = buildWhere(query, {
		base: [eq(leave.status, 'approved'), notDeleted(leave)],
		search: (term) =>
			or(
				like(employee.name, `%${term}%`),
				like(employee.fatherName, `%${term}%`),
				like(site.name, `%${term}%`),
				like(department.name, `%${term}%`),
				like(leave.reason, `%${term}%`)
			),
		// The window is over when the leave was taken, not when it was filed — that is
		// what someone asking "who was off in Sene?" means.
		dateColumn: leave.startDate,
		filters: {
			leaveTypeId: (v) => eq(leave.leaveTypeId, Number(v)),
			departmentId: (v) => eq(employee.departmentId, Number(v)),
			siteId: (v) => eq(employee.siteId, Number(v)),
			approvedById: (v) => eq(leave.approvedBy, v),
			// Buckets rather than a free number box: the bar offers real choices, and a
			// long absence is what anyone scanning this page is actually looking for.
			duration: (v) =>
				v === 'short'
					? lte(leave.days, 3)
					: v === 'medium'
						? and(gt(leave.days, 3), lte(leave.days, 10))
						: v === 'long'
							? gt(leave.days, 10)
							: undefined
		}
	});

	// Same joins as the row query, because the WHERE reaches into employee, site and department.
	const [{ total }] = await db
		.select({ total: count() })
		.from(leave)
		.leftJoin(employee, and(eq(leave.staffId, employee.id), notDeleted(employee)))
		.leftJoin(department, and(eq(employee.departmentId, department.id), notDeleted(department)))
		.leftJoin(site, and(eq(employee.siteId, site.id), notDeleted(site)))
		.where(whereClause);

	const form = await superValidate(zod4(approveLeave));
	const leaves = await db
		.select({
			id: leave.id,
			staffId: leave.staffId,
			name: sql<string>`TRIM(CONCAT(COALESCE(${employee.name}, ''), ' ', COALESCE(${employee.fatherName}, '')))`,
			department: department.name,
			siteName: site.name,
			requestDate: leave.requestDate,
			startDate: leave.startDate,
			endDate: leave.endDate,
			leaveTypeId: leave.leaveTypeId,
			leaveTypeName: leaveType.name,
			reason: leave.reason,
			// Shown on the selection summary and prefilled into the edit dialog, which
			// was already reading it off a row that never carried it.
			rejectionReason: leave.rejectionReason,
			leaveLetter: leave.leaveLetter,
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
		.where(whereClause)
		// `leave` carries no decision timestamp, so the leave's own period is the sort:
		// the most recent absence first, with `id` breaking ties for a stable order.
		.orderBy(desc(leave.startDate), desc(leave.id))
		.limit(query.limit)
		.offset(query.offset);

	const leaveTypeList = await leaveTypes();

	// Every option list is drawn from approved leaves only, so the bar never offers a
	// choice that returns an empty table.
	const approvedOnly = and(eq(leave.status, 'approved'), notDeleted(leave));

	const [leaveTypeOptions, departmentOptions, siteOptions, approverOptions] = await Promise.all([
		db
			.selectDistinct({ id: leaveType.id, name: leaveType.name })
			.from(leave)
			.innerJoin(leaveType, and(eq(leave.leaveTypeId, leaveType.id), notDeleted(leaveType)))
			.where(approvedOnly)
			.orderBy(leaveType.name),
		db
			.selectDistinct({ id: department.id, name: department.name })
			.from(leave)
			.innerJoin(employee, and(eq(leave.staffId, employee.id), notDeleted(employee)))
			.innerJoin(department, and(eq(employee.departmentId, department.id), notDeleted(department)))
			.where(approvedOnly)
			.orderBy(department.name),
		db
			.selectDistinct({ id: site.id, name: site.name })
			.from(leave)
			.innerJoin(employee, and(eq(leave.staffId, employee.id), notDeleted(employee)))
			.innerJoin(site, and(eq(employee.siteId, site.id), notDeleted(site)))
			.where(approvedOnly)
			.orderBy(site.name),
		db
			.selectDistinct({ id: user.id, name: user.name })
			.from(leave)
			.innerJoin(user, eq(leave.approvedBy, user.id))
			.where(approvedOnly)
			.orderBy(user.name)
	]);

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
		form,
		pagination: pagination(query, total),
		currentQuery: currentQuery(query),
		filterOptions: {
			leaveTypes: leaveTypeOptions,
			departments: departmentOptions,
			sites: siteOptions,
			approvers: approverOptions
		}
	};
};

import { saveUploadedFile } from '$lib/server/upload';

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

				// This page only ever un-approves, so the mover is recorded as an editor. The previous
				// code stamped `approvedBy` here, overwriting the original approver on the way out.
				await tx
					.update(leave)
					.set({ status, updatedBy: locals?.user?.id })
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
					`Leave Status changed to ${status === 'pending' ? 'Pending' : 'Rejected'} Successfully!` +
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
						requestDate: new Date(requestDate),
						startDate: new Date(startDate),
						endDate: new Date(endDate),
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
