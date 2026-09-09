import { parseFilters, type ReportFilters } from './filters';
import { resolveSection, type SectionGroup } from './sections';
import { loadSection } from './details.server';
import type { ReportChartData, Stat } from './types';

export type Domain = { stats: Stat[]; charts: ReportChartData[] };

/**
 * A domain failing must not blank the page it is on.
 *
 * These reports read wide — a single table with a surprise in it, a null where
 * an aggregate did not expect one, a column renamed by a migration — and the
 * ledger below the charts is usually still readable when the aggregates are
 * not. The failure is logged and shown in a banner rather than thrown.
 */
async function safe(
	name: string,
	run: () => Promise<Domain>
): Promise<Domain & { failed?: string }> {
	try {
		return await run();
	} catch (error) {
		console.error(`[reports] ${name} failed`, error);
		return { stats: [], charts: [], failed: name };
	}
}

/**
 * The shared body of every report page: resolve the query, run this page's one
 * analytics module, and fetch a page of whichever ledger is open.
 *
 * Each route differs only in its group and its module, so keeping the shape
 * here means a new report is a five-line `+page.server.ts`.
 */
export async function loadReport(
	url: URL,
	group: SectionGroup,
	run: (filters: ReportFilters) => Promise<Domain>
) {
	const requested = parseFilters(url);
	const filters: ReportFilters = {
		...requested,
		section: resolveSection(requested.section, group)
	};

	const [domain, detail] = await Promise.all([
		safe(group, () => run(filters)),
		loadSection(filters)
	]);

	return {
		group,
		filters,
		stats: domain.stats,
		charts: domain.charts,
		failure: domain.failed ?? null,
		detail: {
			rows: detail.rows,
			total: detail.total,
			page: filters.page,
			pageSize: filters.pageSize
		}
	};
}
