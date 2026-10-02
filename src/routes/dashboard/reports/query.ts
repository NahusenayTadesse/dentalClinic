/**
 * The report's address with some params changed — moving to another ledger, another report, or
 * across reports keeping the filters. A plain module rather than component code: the reports'
 * pages and layout all build these, and a `URLSearchParams` mutated inside a component is what
 * the reactivity lint warns about.
 *
 * `null` or `''` drops a param, so a cleared filter leaves a clean address.
 */
export function reportHref(
	current: URL,
	overrides: Record<string, string | number | null>,
	path: string = current.pathname
): string {
	const params = new URLSearchParams(current.searchParams);
	for (const [key, value] of Object.entries(overrides)) {
		if (value === null || value === '') params.delete(key);
		else params.set(key, String(value));
	}
	const query = params.toString();
	return query ? `${path}?${query}` : path;
}
