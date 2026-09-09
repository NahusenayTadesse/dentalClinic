import { db } from '$lib/server/db';
import {
	employee,
	department,
	employmentStatuses,
	educationalLevel,
	employeeTermination,
	missingDays,
	site,
	employeeGuarantor,
	staffAccounts,
	staffFamilies,
	position
} from '$lib/server/db/schema';
import { isApproved } from '$lib/server/approvals';
// import { eq, and, sql, isNull, count, countDistinct } from 'drizzle-orm';
import { notDeleted } from '$lib/server/softDelete';
import { and, eq, count, sql, countDistinct } from 'drizzle-orm';
import { parseTableQuery, buildWhere, pagination, currentQuery } from '$lib/server/queryFilters';

import { edit } from './schema';
import type { PageServerLoad, Actions } from '../$types';
import { superValidate, message } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';

export const load: PageServerLoad = async ({ locals, url }) => {
	// --- Parse query params from QueryBuilder ---
	const query = parseTableQuery(url, [
		'siteId',
		'departmentId',
		'positionId',
		'educationId',
		'statusId',
		'active'
	]);

	// 'true' | 'false' | null — an explicit choice replaces the default
	// "active staff only", rather than contradicting it.
	const active = query.filters.active;
	const activeOnly = active === 'true' || active === 'false' ? active === 'true' : true;

	const nameExpr = sql`TRIM(CONCAT(COALESCE(${employee.name}, ''), ' ', COALESCE(${employee.fatherName}, '')))`;

	const whereClause = buildWhere(query, {
		// Only approved employees belong in the main list; the rest sit in the approval queue.
		base: [eq(employee.isActive, activeOnly), isApproved(employee)!, notDeleted(employee)],
		search: (term) => sql`${nameExpr} LIKE ${'%' + term + '%'}`,
		filters: {
			siteId: (v) => eq(employee.siteId, Number(v)),
			departmentId: (v) => eq(employee.departmentId, Number(v)),
			positionId: (v) => eq(employee.positionId, Number(v)),
			educationId: (v) => eq(employee.educationalLevel, Number(v)),
			statusId: (v) => eq(employee.employmentStatus, Number(v))
			// `active` is folded into `base` above, not applied on top of it.
		}
	});

	// --- Filter option lists (independent of current filters, for the selects) ---
	const [siteOptions, departmentOptions, positionOptions, educationOptions, statusOptions] =
		await Promise.all([
			db.select({ id: site.id, name: site.name }).from(site).where(notDeleted(site)),
			db.select({ id: department.id, name: department.name }).from(department),
			db.select({ id: position.id, name: position.name }).from(position),
			db.select({ id: educationalLevel.id, name: educationalLevel.name }).from(educationalLevel),
			db
				.select({ id: employmentStatuses.id, name: employmentStatuses.name })
				.from(employmentStatuses)
		]);

	// --- Total count for pagination ---
	const [{ total }] = await db.select({ total: count() }).from(employee).where(whereClause);

	// --- Main query ---
	let staffList = await db
		.select({
			id: employee.id,
			name: sql<string>`TRIM(CONCAT(COALESCE(${employee.name}, ''), ' ', COALESCE(${employee.fatherName}, '')))`,
			department: department.name,
			position: position.name,
			site: site.name,
			siteId: site.id,
			education: educationalLevel.name,
			status: employmentStatuses.name,

			guarantor: countDistinct(employeeGuarantor.id),
			accounts: countDistinct(staffAccounts.id),
			families: countDistinct(staffFamilies.id),
			active: employee.isActive,
			years: sql<number>`TIMESTAMPDIFF(YEAR, ${employee.hireDate}, CURDATE())`,
			joined: sql<string>`DATE_FORMAT(${employee.hireDate}, '%Y-%m-%d')`
		})
		.from(employee)
		.leftJoin(site, and(eq(site.id, employee.siteId), notDeleted(site)))
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
			site.name,
			educationalLevel.name,
			employmentStatuses.name,
			employee.isActive,
			employee.hireDate
		)
		.limit(query.limit)
		.offset(query.offset);

	staffList = staffList.map((r) => ({ ...r, years: Number(r.years) }));

	return {
		staffList,
		pagination: pagination(query, total),
		filterOptions: {
			sites: siteOptions,
			departments: departmentOptions,
			positions: positionOptions,
			educations: educationOptions,
			statuses: statusOptions
		},
		currentQuery: currentQuery(query)
	};
};

export const actions: Actions = {
	addDays: async ({ request, cookies, locals }) => {
		const form = await superValidate(request, zod4(edit));

		if (!form.valid) {
			return message(form, { type: 'error', text: `Error: check the form` });
		}

		const { id, day, reason, deductable, deductableAmount } = form.data;

		try {
			const dateList = day.split(',');
			await db.transaction(async (tx) => {
				const valuesToInsert = dateList.map((singleDay) => ({
					staffId: Number(id),
					day: singleDay.trim(), // trim() handles potential spaces like "2026-01-01, 2026-01-02"
					reason,
					deductable: Boolean(deductable),
					deductableAmount: deductableAmount ? parseFloat(deductableAmount) : null,
					createdBy: locals?.user?.id
				}));

				// 3. Perform a single batch insert
				await tx.insert(missingDays).values(valuesToInsert);
			});
			return message(form, {
				type: 'success',
				text: 'Missing Days added Successfully!'
			});
		} catch (err) {
			console.error(err?.message);
			return message(form, {
				type: 'error',
				text: `Adding missing days failed: ${err instanceof Error ? err.message : 'Unknown error'}`
			});
		}
	}
};
