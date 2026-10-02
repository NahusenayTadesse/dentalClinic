import { leaveActions } from '$lib/server/leaveActions';
import { db } from '$lib/server/db';
import { leave, leaveType, employee, department, branch, user } from '$lib/server/db/schema';

import { eq, and } from 'drizzle-orm';
import { notDeleted } from '$lib/server/softDelete';
import { alias } from 'drizzle-orm/mysql-core';

import type { PageServerLoad, Actions } from './$types';
import { superValidate } from 'sveltekit-superforms';
import { leaveTypes } from '$lib/server/fastData';
import { zod4 } from 'sveltekit-superforms/adapters';
import { approveLeaveFor, editLeave } from '$lib/components/leaves/schema';

/** This page lists 'pending' leaves, so the bulk action offers the other two states. */
const approveLeave = approveLeaveFor('pending');

export const load: PageServerLoad = async () => {
	const form = await superValidate(zod4(approveLeave));

	const approver = alias(user, 'approver');
	const adder = alias(user, 'adder');

	const leaves = await db
		.select({
			id: leave.id,
			staffId: leave.staffId,
			name: employeeFullName,
			department: department.name,
			branchName: branch.name,
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
			approvedBy: approver.name,
			approvedById: approver.id,
			addedBy: adder.name,
			addedById: adder.id,
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
		.leftJoin(branch, and(eq(employee.branchId, branch.id), notDeleted(branch)))
		.leftJoin(approver, eq(leave.approvedBy, approver.id))
		.leftJoin(adder, eq(leave.createdBy, adder.id))
		.where(and(eq(leave.status, 'pending'), notDeleted(leave)));

	const leaveTypeList = await leaveTypes();

	// One edit form for the page, seeded from the row being changed — not a form per row.
	const editForm = await superValidate(zod4(editLeave));

	return {
		salaryHistory: leaves,
		leaveTypeList,
		editForm,
		form
	};
};

import { employeeFullName } from '$lib/server/employeeName';

/** Batch moves, edits and deletes — the same on every leave list (`leaveActions`). */
export const actions = leaveActions('pending') satisfies Actions;
