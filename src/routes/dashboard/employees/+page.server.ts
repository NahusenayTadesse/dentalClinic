import { db } from '$lib/server/db';
import {
	employee,
	department,
	employmentStatuses,
	educationalLevel,
	employeeTermination,
	missingDays,
	branch,
	employeeGuarantor,
	staffAccounts,
	staffFamilies,
	position
} from '$lib/server/db/schema';
import { isApproved } from '$lib/server/approvals';
// import { eq, and, sql, isNull, count, countDistinct } from 'drizzle-orm';
import { notDeleted } from '$lib/server/softDelete';
import { and, eq, count, sql, countDistinct } from 'drizzle-orm';
import type { MySqlColumn } from 'drizzle-orm/mysql-core';
import { branchFilter } from '$lib/server/branchScope';
import { isoDate, yearsSince } from '$lib/server/db/dialect';
import {
	parseTableQuery,
	buildWhere,
	pagination,
	currentQuery,
	facetCounts,
	orderBy
} from '$lib/server/queryFilters';

import { edit } from './schema';
import type { PageServerLoad, Actions } from '../$types';
import { superValidate, message } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { employeeFullName } from '$lib/server/employeeName';

export const load: PageServerLoad = async ({ locals, url }) => {
	// --- Parse query params from QueryBuilder ---
	/*
	 * What the table may sort by, and what each key actually sorts on — often not the column it
	 * displays. "Years of service" is computed from `hire_date`, so it sorts by the date; sorting
	 * by the rendered number would mean computing it for every row before paginating, which is
	 * the whole reason the list is paged in SQL.
	 */
	const SORTABLE = {
		name: employeeFullName,
		department: department.name,
		position: position.name,
		branch: branch.name,
		education: educationalLevel.name,
		status: employmentStatuses.name,
		years: employee.hireDate
	};

	const query = parseTableQuery(
		url,
		['departmentId', 'positionId', 'educationId', 'statusId', 'active'],
		undefined,
		Object.keys(SORTABLE)
	);

	// 'true' | 'false' | null — an explicit choice replaces the default
	// "active staff only", rather than contradicting it.
	const active = query.filters.active;
	const activeOnly = active === 'true' || active === 'false' ? active === 'true' : true;

	// Extracted rather than inlined so the facet tallies can be built from the same spec with one
	// filter dropped — see `facetCounts` for why a facet must not filter itself.
	const whereSpec = {
		// Only approved employees belong in the main list; the rest sit in the approval queue.
		/*
		 * Branch is context rather than a filter, so it is applied here from `locals.branch` and
		 * has no dropdown, no column filter and no chart facet of its own. One selector in the top
		 * bar decides it for the whole app; `undefined` when the user is seeing across branches.
		 */
		base: [
			eq(employee.isActive, activeOnly),
			isApproved(employee)!,
			notDeleted(employee),
			branchFilter(employee.branchId, locals.branch)
		],
		search: (term: string) => sql`${employeeFullName} LIKE ${'%' + term + '%'}`,
		filters: {
			departmentId: (v: string) => eq(employee.departmentId, Number(v)),
			positionId: (v: string) => eq(employee.positionId, Number(v)),
			educationId: (v: string) => eq(employee.educationalLevel, Number(v)),
			statusId: (v: string) => eq(employee.employmentStatus, Number(v))
			// `active` is folded into `base` above, not applied on top of it.
		}
	};

	const whereClause = buildWhere(query, whereSpec);

	// --- Total count for pagination ---
	const [{ total }] = await db.select({ total: count() }).from(employee).where(whereClause);

	// --- Main query ---
	let staffList = await db
		.select({
			id: employee.id,
			name: employeeFullName,
			department: department.name,
			position: position.name,
			branch: branch.name,
			branchId: branch.id,
			education: educationalLevel.name,
			status: employmentStatuses.name,

			guarantor: countDistinct(employeeGuarantor.id),
			accounts: countDistinct(staffAccounts.id),
			families: countDistinct(staffFamilies.id),
			active: employee.isActive,
			years: yearsSince(employee.hireDate),
			joined: isoDate(employee.hireDate)
		})
		.from(employee)
		.leftJoin(branch, and(eq(branch.id, employee.branchId), notDeleted(branch)))
		.leftJoin(department, and(eq(department.id, employee.departmentId), notDeleted(department)))
		.leftJoin(position, and(eq(position.id, employee.positionId), notDeleted(position)))
		.leftJoin(
			employmentStatuses,
			and(eq(employmentStatuses.id, employee.employmentStatus), notDeleted(employmentStatuses))
		)
		.leftJoin(
			educationalLevel,
			and(eq(educationalLevel.id, employee.educationalLevel), notDeleted(educationalLevel))
		)
		.leftJoin(employeeTermination, eq(employeeTermination.staffId, employee.id))
		.leftJoin(staffAccounts, and(eq(staffAccounts.staffId, employee.id), notDeleted(staffAccounts)))
		.leftJoin(
			employeeGuarantor,
			and(eq(employeeGuarantor.staffId, employee.id), notDeleted(employeeGuarantor))
		)
		.leftJoin(staffFamilies, and(eq(staffFamilies.staffId, employee.id), notDeleted(staffFamilies)))
		.where(whereClause)
		.groupBy(
			employee.id,
			employee.name,
			employee.fatherName,
			department.name,
			position.name,
			branch.name,
			educationalLevel.name,
			employmentStatuses.name,
			employee.isActive,
			employee.hireDate
		)
		.orderBy(...(orderBy(query, SORTABLE) ?? []), employee.id)
		.limit(query.limit)
		.offset(query.offset);

	staffList = staffList.map((r) => ({ ...r, years: Number(r.years) }));

	/*
	 * The tallies behind the column filters and the chart.
	 *
	 * These have to be counted here. The page used to hand its filter menu the rows it had just
	 * paginated down to, which then counted them and labelled the result as the whole clinic —
	 * a chart of twenty-five employees titled as though it were all of them.
	 *
	 * Each is counted with every other filter applied but not its own, so the options within one
	 * list stay comparable. Keyed by column id, which is what puts each filter in its own header.
	 */
	const facetFor = (
		value: MySqlColumn,
		label: MySqlColumn,
		except: 'departmentId' | 'positionId' | 'statusId'
	) =>
		db
			.select({ value, label, count: countDistinct(employee.id) })
			.from(employee)
			.leftJoin(branch, and(eq(branch.id, employee.branchId), notDeleted(branch)))
			.leftJoin(department, and(eq(department.id, employee.departmentId), notDeleted(department)))
			.leftJoin(position, and(eq(position.id, employee.positionId), notDeleted(position)))
			.leftJoin(
				employmentStatuses,
				and(eq(employmentStatuses.id, employee.employmentStatus), notDeleted(employmentStatuses))
			)
			.leftJoin(
				educationalLevel,
				and(eq(educationalLevel.id, employee.educationalLevel), notDeleted(educationalLevel))
			)
			.where(buildWhere(query, whereSpec, { except }))
			.groupBy(value, label);

	/*
	 * The id is the value and the name is the label. Tallying by name alone is what broke every
	 * one of these: clicking "Piassa Clinic" wrote `branchId=Piassa+Clinic`, `buildWhere` did
	 * `Number(...)` on it, and the page came back with no table at all.
	 */
	/*
	 * "None here" and "none at all" are different sentences, and only this tells them apart.
	 *
	 * Branch scoping made the empty state lie: a clinic with 105 employees across two branches
	 * showed "No employees added yet" to anyone whose working branch happened to have none, with
	 * an invitation to add their first. Counted only when the scoped list is empty, so the normal
	 * page pays nothing for it.
	 */
	const elsewhere =
		total === 0
			? await db
					.select({ total: count() })
					.from(employee)
					.where(
						and(eq(employee.isActive, activeOnly), isApproved(employee)!, notDeleted(employee))
					)
					.then(([row]) => Number(row?.total ?? 0))
			: 0;

	const facets = await facetCounts({
		department: () => facetFor(department.id, department.name, 'departmentId'),
		position: () => facetFor(position.id, position.name, 'positionId'),
		status: () => facetFor(employmentStatuses.id, employmentStatuses.name, 'statusId')
	});

	return {
		staffList,
		facets,
		/** How many exist outside this branch, when this branch has none. */
		elsewhere,
		pagination: pagination(query, total),
		currentQuery: currentQuery(query)
	};
};

export const actions: Actions = {
	/**
	 * Records days an employee was absent.
	 *
	 * Deliberately not gated beyond the page's own rule: adding a missing day is the ordinary work
	 * of whoever keeps attendance, and the route already requires `employees.create_followup` to
	 * reach this path at all (§9). It becomes a `requirePermission` call the day it can deduct pay
	 * without an approval step — which is what `approval` on the row is there to prevent.
	 */
	addDays: async ({ request, locals }) => {
		const form = await superValidate(request, zod4(edit));

		if (!form.valid) {
			return message(form, { type: 'error', text: 'Please check the form and try again.' });
		}

		const { id, day, reason, deductable, deductableAmount } = form.data;

		try {
			// Comma-separated because the picker allows several dates in one go; trimmed because
			// "2026-01-01, 2026-01-02" is what it produces.
			const days = day
				.split(',')
				.map((d) => d.trim())
				.filter(Boolean);

			if (!days.length) {
				return message(form, { type: 'error', text: 'Pick at least one day.' });
			}

			await db.insert(missingDays).values(
				days.map((singleDay) => ({
					staffId: Number(id),
					day: singleDay,
					reason,
					deductable: Boolean(deductable),
					deductableAmount: deductableAmount ? parseFloat(deductableAmount) : null,
					createdBy: locals?.user?.id
				}))
			);

			return message(form, {
				type: 'success',
				text: days.length === 1 ? 'Missing day added.' : `${days.length} missing days added.`
			});
		} catch (err: unknown) {
			/*
			 * Loud in the log, quiet to the client (§9). This used to put `err.message` straight
			 * into the toast, which hands a database error — table names, constraint names — to
			 * whoever provoked it.
			 */
			console.error('[employees] addDays failed:', err);

			return message(form, {
				type: 'error',
				text: 'Could not add those days. Please try again.'
			});
		}
	}
};
