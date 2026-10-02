import { register } from '$lib/server/attendance';
import { payrollPeriod } from '$lib/server/payrollRun';
import { currentEthiopianMonthParam } from '$lib/global.svelte';
import { daysBetween, summarise } from '$lib/attendance';
import type { PageServerLoad } from './$types';

/**
 * The month at a glance: everyone at this branch down the side, every day of an Ethiopian month
 * across, each cell what the day was — so an absence, which is a day with nothing recorded, shows
 * as one. The month is payroll's month (`payrollPeriod`), so what is red here is what the run
 * deducts. `?month=<month>_<year>`, the current one by default.
 */
export const load: PageServerLoad = async ({ url, locals }) => {
	const month = url.searchParams.get('month') || decodeURIComponent(currentEthiopianMonthParam());
	const period = payrollPeriod(month);
	const rows = await register(period.start, period.end, { branch: locals.branch });
	const days = daysBetween(period.start, period.end);

	return {
		month,
		days,
		rows: rows.map((row) => {
			const decided = days.map((day) => row.days[day]);
			return {
				id: row.id,
				name: row.name,
				department: row.department,
				position: row.position,
				// Only what a cell draws; the register has the rest.
				cells: Object.fromEntries(
					days.map((day) => {
						const d = row.days[day];
						return [
							day,
							{
								kind: d.kind,
								late: d.late,
								worked: d.worked,
								clockIn: d.record?.clockIn ?? null,
								clockOut: d.record?.clockOut ?? null,
								note: d.record?.note ?? null
							}
						];
					})
				),
				...summarise(decided)
			};
		})
	};
};
