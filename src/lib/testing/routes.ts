import { readdirSync } from 'node:fs';
import { join, sep } from 'node:path';

/**
 * Every address under `/dashboard`, read off the filesystem, for tests that check a registry
 * against the routes that really exist.
 *
 * Three tests need this list: the route gate (every page has a rule), help coverage (every page
 * has help) and navigation (every menu link is a page). The first two each carried their own
 * walker, which is the point at which a third copy was about to be written, so it lives here.
 *
 * Paths come back as SvelteKit spells them on disk, with `[param]` segments intact —
 * `/dashboard/patients/[id]`. Matching a concrete URL against those is the caller's job.
 *
 * Node-only (it reads the disk). Import it from `*.test.ts` files, never from app code.
 */

const ROUTES_ROOT = join(process.cwd(), 'src', 'routes');

/**
 * The pages under `/dashboard`, sorted and de-duplicated.
 *
 * `endpoints: true` also counts directories that hold only a `+server.ts` — the backup download,
 * the branch switch. The route gate needs those, because they are reachable addresses behind a
 * permission; help does not, because nobody reads a download.
 *
 * `redirects: true` also counts directories whose only file is a `+page.server.ts`. Those are
 * redirects (`/salary/add-payroll` to the current month), so a link to one works; navigation
 * needs them, and help does not, because nobody ever sees the page.
 */
export function dashboardRoutes({
	endpoints = false,
	redirects = false
}: { endpoints?: boolean; redirects?: boolean } = {}): string[] {
	function walk(dir: string): string[] {
		const found: string[] = [];

		for (const entry of readdirSync(dir, { withFileTypes: true })) {
			if (entry.isDirectory()) {
				found.push(...walk(join(dir, entry.name)));
			} else if (
				entry.name === '+page.svelte' ||
				(endpoints && entry.name === '+server.ts') ||
				(redirects && entry.name === '+page.server.ts')
			) {
				// `src/routes/dashboard/foo/+page.svelte` -> `/dashboard/foo`
				found.push(dir.slice(ROUTES_ROOT.length).split(sep).join('/') || '/');
			}
		}

		return found;
	}

	return [...new Set(walk(join(ROUTES_ROOT, 'dashboard')))].sort();
}
