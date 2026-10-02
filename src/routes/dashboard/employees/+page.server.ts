import { db } from '$lib/server/db';
import {
	employee,
	department,
	employmentStatuses,
	educationalLevel,
	employeeTermination,
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

import type { PageServerLoad } from './$types';
import { employeeFullName } from '$lib/server/employeeName';

export const load: PageServerLoad = async ({ locals, url }) => {
	// --- The table's query params: search, paging, sort, and each column's filter ---
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
