import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
	APPROVAL_QUEUES,
	NAVIGATION,
	activeGroup,
	searchEntries,
	settingsSections
} from './navigation';
import { APPROVAL_ENTITIES } from './server/approvals';
import { dashboardRoutes } from './testing/routes';

/**
 * Guards the menu against the two kinds of drift it had: links to pages that do not exist, and
 * pages (approval queues, here) that exist with no link.
 */

/** A route as SvelteKit spells it on disk, as a pattern a concrete URL can be tested against. */
function routePattern(route: string): RegExp {
	const escaped = route.replace(/[.*+?^${}()|\\]/g, '\\$&').replace(/\[[^\]]+\]/g, '[^/]+');
	return new RegExp(`^${escaped}$`);
}

const routes = dashboardRoutes({ redirects: true }).map(routePattern);

/** Every address the sidebar or the palette can send someone to. */
const everyLink = searchEntries(() => true).map((entry) => entry.url);

describe('navigation', () => {
	it('links only to pages that exist', () => {
		const dead = everyLink.filter((url) => !routes.some((route) => route.test(url)));

		expect(dead, `these menu links have no page:\n  ${dead.join('\n  ')}`).toEqual([]);
	});

	/*
	 * The menus along the top of an area — Employees, Salary, Supplies, Leaves — are written in each
	 * area's `+layout.svelte`, not here, and two of them kept linking to per-site pages pruned with
	 * the facilities features. They are read off the files so the same rule reaches them.
	 */
	it('links only to pages that exist from the menus along the top of an area', () => {
		const layouts = dashboardRoutes({ redirects: true })
			.map((route) => join(process.cwd(), 'src', 'routes', ...route.split('/'), '+layout.svelte'))
			.flatMap((file) => {
				try {
					return [readFileSync(file, 'utf8')];
				} catch {
					return [];
				}
			})
			.filter((source) => source.includes('LayoutMenu'));
		const hrefs = layouts.flatMap((source) =>
			[...source.matchAll(/href: '([^']+)'/g)].map((m) => m[1])
		);
		const dead = hrefs.filter((url) => !routes.some((route) => route.test(url)));

		expect(hrefs.length).toBeGreaterThan(0);
		expect(dead, `these area-menu links have no page:\n  ${dead.join('\n  ')}`).toEqual([]);
	});

	it('has a menu entry for every approval queue, spelled the same way', () => {
		expect(APPROVAL_QUEUES.map((q) => q.key).sort()).toEqual(
			APPROVAL_ENTITIES.map((e) => e.key).sort()
		);
	});

	it('offers only what the viewer can open', () => {
		const onlyHelp = searchEntries((url) => url === '/dashboard/help');

		expect(onlyHelp).toEqual([{ label: 'Help', url: '/dashboard/help' }]);
	});

	it('lists each address once in the palette', () => {
		expect(new Set(everyLink).size).toBe(everyLink.length);
	});

	/*
	 * Ten clinic lookups had no menu entry, reachable only by typing the address. A screen of its
	 * own — not a record (`[id]`) or a step inside another (`add-…`) — has to be in the menu.
	 */
	it('links every admin-panel screen', () => {
		const screens = dashboardRoutes().filter(
			(r) => r.startsWith('/dashboard/admin-panel/') && !/\[|\/add-/.test(r)
		);
		const unlinked = screens.filter((r) => !everyLink.includes(r));

		expect(unlinked, `add these to NAVIGATION:\n  ${unlinked.join('\n  ')}`).toEqual([]);
	});

	it('puts every admin-panel link on a card of the admin index', () => {
		const onCards = settingsSections(() => true).flatMap((s) => s.items.map((i) => i.url));
		const linked = everyLink.filter((u) => u.startsWith('/dashboard/admin-panel/'));
		const loose = linked.filter((u) => !onCards.includes(u));

		expect(loose, `give these a section in NAVIGATION:\n  ${loose.join('\n  ')}`).toEqual([]);
	});

	/*
	 * Clinic Setup, Admin Panel and Supplies all hold pages under `/dashboard/admin-panel`, which is
	 * why the highlight is chosen by the most specific link rather than a prefix.
	 */
	it('highlights the group holding the most specific link', () => {
		expect(activeGroup(NAVIGATION, '/dashboard/admin-panel/chairs')).toBe('Clinic Setup');
		expect(activeGroup(NAVIGATION, '/dashboard/admin-panel/supply-types')).toBe('Supplies');
		expect(activeGroup(NAVIGATION, '/dashboard/admin-panel/pensions')).toBe('Admin Panel');
		expect(activeGroup(NAVIGATION, '/dashboard/admin-panel')).toBe('Admin Panel');
		expect(activeGroup(NAVIGATION, '/dashboard/patients/42')).toBe('Patients');
		expect(activeGroup(NAVIGATION, '/dashboard')).toBe('Dashboard');
		expect(activeGroup(NAVIGATION, '/dashboard/approvals/refunds')).toBe('Approvals');
	});
});
