/**
 * The one place server-side table filtering lives.
 *
 * Every paginated list page in the dashboard is driven by the same filter bar
 * (`$lib/QueryBuilder.svelte`): a search box, a page size, an optional date
 * range, and a handful of dropdowns that list out what you can pick. Before
 * this module each `+page.server.ts` re-parsed those params, re-assembled the
 * `WHERE`, re-ran its own `count()` and re-shaped its own return object — nine
 * copies of the same five steps, drifting apart from each other.
 *
 * A load now declares *what* its filters mean and leaves the mechanics here:
 *
 *   const query = parseTableQuery(url, ['branchId', 'departmentId']);
 *   const where = buildWhere(query, {
 *     base: [eq(employee.isActive, true), notDeleted(employee)],
 *     search: (term) => like(employee.name, `%${term}%`),
 *     filters: {
 *       branchId: (v) => eq(employee.branchId, Number(v)),
 *       departmentId: (v) => eq(employee.departmentId, Number(v))
 *     }
 *   });
 *
 * and then returns `pagination(query, total)` and `currentQuery(query)` so the
 * component on the other side always receives the same shape.
 *
 * This deliberately only expresses filters the bar can offer: equality against
 * a listed option, a search term, and a date window. Free-form "contains this
 * but not that" condition building is not part of it — those tables get a
 * dropdown of real choices instead.
 */
import { and, type SQL } from 'drizzle-orm';
import type { MySqlColumn } from 'drizzle-orm/mysql-core';
import { currentMonthFilter } from '$lib/global.svelte';

/** Page size options the bar offers; anything else is clamped into range. */
const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 20;

export type TableQuery<F extends string = string> = {
	search: string;
	page: number;
	pageSize: number;
	dateStart: string | null;
	dateEnd: string | null;
	/** Raw dropdown selections, keyed by the param name that carried them. */
	filters: Record<F, string | null>;
	/** Ready to pass straight to `.limit()` / `.offset()`. */
	limit: number;
	offset: number;
};

/** A positive integer from a query string, or the fallback. */
function toInt(raw: string | null, fallback: number): number {
	const n = Number(raw);
	return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

/**
 * Reads the filter bar's params off the URL. `filterKeys` are the page's own
 * dropdowns — anything not listed is ignored, so a stale or hand-typed param
 * can never reach a `WHERE` clause.
 */
export function parseTableQuery<const F extends readonly string[]>(
	url: URL,
	filterKeys: F = [] as unknown as F,
	defaultPageSize = DEFAULT_PAGE_SIZE
): TableQuery<F[number]> {
	const page = toInt(url.searchParams.get('page'), 1);
	const pageSize = Math.min(
		toInt(url.searchParams.get('pageSize'), defaultPageSize),
		MAX_PAGE_SIZE
	);

	const filters = {} as Record<F[number], string | null>;
	for (const key of filterKeys) {
		// Empty string is the bar's "All …" option, which means no filter at all.
		filters[key as F[number]] = url.searchParams.get(key)?.trim() || null;
	}

	return {
		search: url.searchParams.get('search')?.trim() ?? '',
		page,
		pageSize,
		dateStart: url.searchParams.get('dateStart')?.trim() || null,
		dateEnd: url.searchParams.get('dateEnd')?.trim() || null,
		filters,
		limit: pageSize,
		offset: (page - 1) * pageSize
	};
}

export type WhereSpec<F extends string> = {
	/** Conditions that apply no matter what is filtered — active, approved, not deleted. */
	base?: (SQL | undefined)[];
	/** Builds the search condition. Skipped when the box is empty. */
	search?: (term: string) => SQL | undefined;
	/**
	 * The column a date range narrows. Both ends must be set for it to apply,
	 * which is what the bar always sends.
	 */
	dateColumn?: MySqlColumn;
	/** One builder per dropdown. Skipped when nothing is selected. */
	filters?: Partial<Record<F, (value: string) => SQL | undefined>>;
};

/**
 * Assembles the whole `WHERE` for a load. Undefined when nothing constrains it.
 *
 * `options.except` drops one dropdown's own condition. That is only for counting facets, and it
 * is not an optimisation — it is what makes the counts mean anything. A facet list that applied
 * its own filter would report "Active: 120" next to every other option showing 0, because the
 * rows that would have been in them were already excluded. Every faceted UI works this way; see
 * `facetCounts`.
 */
export function buildWhere<F extends string>(
	query: TableQuery<F>,
	spec: WhereSpec<F>,
	options: { except?: F } = {}
): SQL | undefined {
	const conditions: (SQL | undefined)[] = [...(spec.base ?? [])];

	if (query.search && spec.search) conditions.push(spec.search(query.search));

	if (spec.dateColumn && query.dateStart && query.dateEnd) {
		conditions.push(currentMonthFilter(spec.dateColumn, query.dateStart, query.dateEnd));
	}

	for (const [key, build] of Object.entries(spec.filters ?? {})) {
		if (options.except === key) continue;

		const value = query.filters[key as F];
		if (!value || !build) continue;
		conditions.push((build as (v: string) => SQL | undefined)(value));
	}

	return and(...conditions.filter((c): c is SQL => c !== undefined));
}

/** The `pagination` half of a load's return value. */
export function pagination(query: TableQuery, total: number | string) {
	return { page: query.page, pageSize: query.pageSize, total: Number(total) };
}

/**
 * The `currentQuery` half — what the bar reads back to show its own state.
 * Flattened so a page can do `data.currentQuery.branchId` as before.
 */
export function currentQuery<F extends string>(query: TableQuery<F>) {
	return {
		search: query.search,
		dateStart: query.dateStart,
		dateEnd: query.dateEnd,
		...query.filters
	};
}

/**
 * Pagination for the few lists whose interesting columns are computed in JS
 * after the query — supply stock levels, lease overdue days. They cannot be
 * expressed as SQL, so the rows are narrowed in memory and sliced here,
 * keeping the returned shape identical to a SQL-paginated page.
 */
export function paginate<T>(rows: T[], query: TableQuery): { rows: T[]; total: number } {
	return { rows: rows.slice(query.offset, query.offset + query.limit), total: rows.length };
}

/**
 * One faceted column's tally: how many rows carry each value.
 *
 * The caller writes the query, because a facet is almost always on a joined column — a
 * department's name, a branch's name — and inventing a join description here would be a small
 * ORM on top of the one we have. This only runs them together and shapes the result.
 */
export type FacetQuery = () => Promise<
	{ value: string | number | null; label?: string | null; count: number | string }[]
>;

/** One value a column can be filtered by: what to send, what to show, how many rows carry it. */
export type Facet = { value: string; label: string; count: number };

/**
 * Runs a page's facet tallies and shapes them for the table.
 *
 * **Why the server has to do this at all.** The table used to draw its facet counts and its
 * charts from the rows it had been handed. On a server-paginated page that is one page of them,
 * so `/dashboard/employees` was drawing a chart of the current twenty-five employees and
 * labelling it as the clinic. Counting where the rows are is the only way the number is true.
 *
 * Build each query with `buildWhere(query, spec, { except: key })`, so a facet does not filter
 * itself out of its own tally.
 *
 *     const facets = await facetCounts({
 *       department: () =>
 *         db.select({ value: department.id, label: department.name, count: count() })
 *           .from(employee)
 *           .innerJoin(department, and(eq(employee.departmentId, department.id), notDeleted(department)))
 *           .where(buildWhere(query, spec, { except: 'departmentId' }))
 *           .groupBy(department.id, department.name)
 *     });
 *
 * **`value` and `label` are separate on purpose.** `value` is what goes into the URL and back
 * through the filter builder — for a foreign key that is the id. `label` is what the reader sees.
 * Tallying by name alone shipped once and broke every foreign-key facet on the page: clicking
 * "Piassa Clinic" wrote `branchId=Piassa+Clinic`, the builder did `Number(...)` on it, and the
 * list came back empty.
 *
 * Cost is one grouped query per faceted column, run in parallel. Facet a column with an index
 * and it is cheap; facet six unindexed columns on a large table and it will not be, which is the
 * reason a page declares its facets rather than getting them by default.
 *
 * Null and empty values are dropped — "no department" is not a filter anyone can pick, and a
 * blank chart segment is noise.
 */
export async function facetCounts(
	spec: Record<string, FacetQuery>
): Promise<Record<string, Facet[]>> {
	const keys = Object.keys(spec);
	const results = await Promise.all(keys.map((key) => spec[key]()));

	const out: Record<string, Facet[]> = {};

	keys.forEach((key, i) => {
		const facets: Facet[] = [];

		for (const row of results[i]) {
			if (row.value === null || row.value === undefined || row.value === '') continue;

			facets.push({
				value: String(row.value),
				label: String(row.label ?? row.value),
				count: Number(row.count)
			});
		}

		facets.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
		out[key] = facets;
	});

	return out;
}
