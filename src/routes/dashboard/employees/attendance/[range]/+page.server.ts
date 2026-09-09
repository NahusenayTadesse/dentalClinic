import { db } from '$lib/server/db';
import { employee, department, employmentStatuses, missingDays, site } from '$lib/server/db/schema';
import { eq, and, sql, count, inArray } from 'drizzle-orm';
import { notDeleted } from '$lib/server/softDelete';
import { edit } from './schema';
import type { PageServerLoad, Actions } from '../$types';
import { superValidate, message } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { getMonthNumber, ethiopianRange, currentMonthFilter } from '$lib/global.svelte';

export const load: PageServerLoad = async ({ params }) => {
	const { range } = params;

	const [m, y] = range.split('_');
	const monthNumber = getMonthNumber(m);
	const year = Number(y);

	const { startDate, endDate } = ethiopianRange(monthNumber, year);
	const start = `${startDate.year}-${startDate.month}-${startDate.day}`;
	const end = `${endDate.year}-${endDate.month}-${endDate.day}`;

	let staffList = await db
		.select({
			id: employee.id,
			name: sql<string>`TRIM(CONCAT(
    COALESCE(${employee.name}, ''), ' ',
    COALESCE(${employee.fatherName}, ''), ' ',
    COALESCE(${employee.grandFatherName}, '')
))`,
			department: department.name,
			status: employmentStatuses.name,
			site: site.name,
			absent: count(missingDays.id),

			deductable: sql<number>`SUM(CASE WHEN ${missingDays.deductable} = true THEN 1 ELSE 0 END)`,

			// Conditional Count for False: Sum 1 if false, else 0
			nonDeductable: sql<number>`SUM(CASE WHEN ${missingDays.deductable} = false THEN 1 ELSE 0 END)`,
			allAbsentDays: sql<string>`GROUP_CONCAT(${missingDays.day})`,
			deductableDays: sql<string>`GROUP_CONCAT(CASE WHEN ${missingDays.deductable} = true THEN ${missingDays.day} ELSE NULL END)`,
			nonDeductableDays: sql<string>`GROUP_CONCAT(CASE WHEN ${missingDays.deductable} = false THEN ${missingDays.day} ELSE NULL END)`,
			allReasons: sql<string>`GROUP_CONCAT(${missingDays.reason})`,

			// This creates a list like "2026-03-01 (Sick), 2026-03-05 (Personal)"
			daysWithReasons: sql<string>`
        GROUP_CONCAT(
          CONCAT(${missingDays.day}, ' (', COALESCE(${missingDays.reason}, 'No Reason'), ')')
          SEPARATOR ', '
        )
      `,

			// Optional: Categorized reasons based on deductibility
			deductableReasons: sql<string>`
        GROUP_CONCAT(CASE WHEN ${missingDays.deductable} = true THEN ${missingDays.reason} ELSE NULL END)
      `,
			nonDeductableReasons: sql<string>`
           GROUP_CONCAT(CASE WHEN ${missingDays.deductable} = false THEN ${missingDays.reason} ELSE NULL END)
         `
		})
		.from(employee)
		.leftJoin(department, and(eq(department.id, employee.departmentId), notDeleted(department)))
		.leftJoin(site, and(eq(site.id, employee.siteId), notDeleted(site)))
		.leftJoin(
			missingDays,
			and(eq(missingDays.staffId, employee.id), currentMonthFilter(missingDays.day, start, end))
		)
		.leftJoin(
			employmentStatuses,
			and(eq(employmentStatuses.id, employee.employmentStatus), notDeleted(employmentStatuses))
		)
		.where(and(eq(employee.isActive, true), notDeleted(employee)))
		.groupBy(
			employee.id,
			employee.name,
			employee.fatherName,
			department.name,
			employmentStatuses.name,
			employee.isActive
		);

	return {
		staffList
	};
};

export const actions: Actions = {
	addDays: async ({ request, cookies, locals }) => {
		const form = await superValidate(request, zod4(edit));

		if (!form.valid) {
			return message(form, { type: 'error', text: `Error: check the form` });
		}

		const { id, day, reason, deductable, deductableAmount, oldDays } = form.data;

		try {
			const dateList = day.split(',');
			await db.transaction(async (tx) => {
				if (oldDays) {
					const oldDateList = oldDays.split(',').map((d) => d.trim());

					await tx
						.delete(missingDays)
						.where(and(eq(missingDays.staffId, Number(id)), inArray(missingDays.day, oldDateList)));
				}

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
