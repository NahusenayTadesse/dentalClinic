import { leaveActions } from '$lib/server/leaveActions';
import { db } from '$lib/server/db';
import { leave, leaveType, employee, department, branch, user } from '$lib/server/db/schema';

import { eq, and, or, like, gt, lte, desc, sql, count } from 'drizzle-orm';
import { notDeleted } from '$lib/server/softDelete';
import type { PageServerLoad, Actions } from './$types';
import { superValidate } from 'sveltekit-superforms';
import { leaveTypes } from '$lib/server/fastData';
import { zod4 } from 'sveltekit-superforms/adapters';
import {
	buildWhere,
	currentQuery,
	facetCounts,
	pagination,
	parseTableQuery,
	type WhereSpec
} from '$lib/server/queryFilters';
import { joinedSelect } from '$lib/server/db/joinedSelect';
import { branchFilter } from '$lib/server/branchScope';
import type { SQL } from 'drizzle-orm';
import { approveLeaveFor, editLeave } from '$lib/components/leaves/schema';

/** This page lists 'approved' leaves, so the bulk action offers the other two states. */
const approveLeave = approveLeaveFor('approved');

/**
 * Approved leaves, most recent first.
 *
 * Approved leaves are never cleared out, so this page grew without bound: it loaded
 * every approved leave the company has ever granted and handed the whole set to a
 * client-side `FilterMenu`, which could only narrow rows already in the browser. It
 * now runs on the shared server-side query bar — one page at a time, and the filters
 * reach the whole table rather than the current screenful.
 */
const FILTERS = ['leaveTypeId', 'departmentId', 'approvedById', 'duration'] as const;
type Filter = (typeof FILTERS)[number];

/** How long a leave was, as the duration filter buckets it. */
const durationBucket = sql<string>`case when ${leave.days} <= 3 then 'short' when ${leave.days} <= 10 then 'medium' else 'long' end`;
const durationLabel = sql<string>`case when ${leave.days} <= 3 then 'Up to 3 days' when ${leave.days} <= 10 then '4 to 10 days' else 'Over 10 days' end`;

export const load: PageServerLoad = async ({ url, locals }) => {
	const query = parseTableQuery(url, FILTERS, 20);

	const spec: WhereSpec<Filter> = {
		// The employee's branch is the working branch from the top bar, not a filter (CLAUDE.md §15).
		base: [
			eq(leave.status, 'approved'),
			notDeleted(leave),
			branchFilter(employee.branchId, locals.branch)
		],
		search: (term) =>
			or(
				like(employee.name, `%${term}%`),
				like(employee.fatherName, `%${term}%`),
				like(branch.name, `%${term}%`),
				like(department.name, `%${term}%`),
				like(leave.reason, `%${term}%`)
			),
		// The window is over when the leave was taken, not when it was filed — that is
		// what someone asking "who was off in Sene?" means.
		dateColumn: leave.startDate,
		filters: {
			leaveTypeId: (v) => eq(leave.leaveTypeId, Number(v)),
			departmentId: (v) => eq(employee.departmentId, Number(v)),
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
	};
	const whereClause = buildWhere(query, spec);

	// Same joins as the row query, because the WHERE reaches into employee, branch and department.
	const [{ total }] = await db
		.select({ total: count() })
		.from(leave)
		.leftJoin(employee, and(eq(leave.staffId, employee.id), notDeleted(employee)))
		.leftJoin(department, and(eq(employee.departmentId, department.id), notDeleted(department)))
		.leftJoin(branch, and(eq(employee.branchId, branch.id), notDeleted(branch)))
		.where(whereClause);

	const form = await superValidate(zod4(approveLeave));
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
		.leftJoin(branch, and(eq(employee.branchId, branch.id), notDeleted(branch)))
		.leftJoin(user, eq(leave.approvedBy, user.id))
		.where(whereClause)
		// `leave` carries no decision timestamp, so the leave's own period is the sort:
		// the most recent absence first, with `id` breaking ties for a stable order.
		.orderBy(desc(leave.startDate), desc(leave.id))
		.limit(query.limit)
		.offset(query.offset);

	const leaveTypeList = await leaveTypes();

	/*
	 * The column filters, each counted over every approved leave the other filters match — the whole
	 * result, not this page (`facetCounts`). They replace a filter bar of dropdowns.
	 */
	const facet = async (
		value: SQL<string | number | null>,
		label: SQL<string | null>,
		except: Filter
	) =>
		joinedSelect({ value, label, count: sql<number>`count(*)` }, leave)
			.leftJoin(leaveType, and(eq(leave.leaveTypeId, leaveType.id), notDeleted(leaveType)))
			.leftJoin(employee, and(eq(leave.staffId, employee.id), notDeleted(employee)))
			.leftJoin(department, and(eq(employee.departmentId, department.id), notDeleted(department)))
			.leftJoin(user, eq(leave.approvedBy, user.id))
			.where(buildWhere(query, spec, { except }))
			.groupBy(value, label);
	const facets = await facetCounts({
		leaveTypeName: () => facet(sql`${leaveType.id}`, sql`${leaveType.name}`, 'leaveTypeId'),
		department: () => facet(sql`${department.id}`, sql`${department.name}`, 'departmentId'),
		approvedBy: () => facet(sql`${user.id}`, sql`${user.name}`, 'approvedById'),
		numberOfDays: () => facet(durationBucket, durationLabel, 'duration')
	});

	// One edit form for the page, seeded from the row being changed — not a form per row.
	const editForm = await superValidate(zod4(editLeave));

	return {
		salaryHistory: leaves,
		leaveTypeList,
		editForm,
		form,
		pagination: pagination(query, total),
		currentQuery: currentQuery(query),
		facets
	};
};

import { employeeFullName } from '$lib/server/employeeName';

/** Batch moves, edits and deletes — the same on every leave list (`leaveActions`). */
export const actions = leaveActions('approved') satisfies Actions;
