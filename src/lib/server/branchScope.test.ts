import { describe, expect, it } from 'vitest';
import { resolveBranch, VIEW_ALL_BRANCHES } from './branchScope';
import { db } from '$lib/server/db';
import { user } from '$lib/server/db/schema/user';

/**
 * The cookie is client-controlled, so these are access-control tests rather than UI ones: what
 * comes back must be the intersection of what was asked for and what the user may have.
 */
describe('branch scope', () => {
	async function someUser() {
		const [row] = await db.select({ id: user.id, branchId: user.branchId }).from(user).limit(1);
		return row;
	}

	it('pins a user without the permission to their own branch, whatever the cookie says', async () => {
		const me = await someUser();
		expect(me, 'a user exists to test with').toBeDefined();

		// Asking for a branch they may not see.
		const scope = await resolveBranch('902', me.id, [], false);

		expect(scope.active, 'ignored the cookie').toBe(me.branchId);
		expect(scope.canSeeAll).toBe(false);
		expect(scope.showSelector, 'nothing to choose between').toBe(false);
		expect(scope.options.map((b) => b.id)).toEqual([me.branchId]);
	});

	it('refuses "all branches" to a user without the permission', async () => {
		const me = await someUser();
		const scope = await resolveBranch('all', me.id, [], false);

		expect(scope.active, 'never null for a pinned user').toBe(me.branchId);
	});

	it('lets a holder pick any branch, and all of them', async () => {
		const me = await someUser();

		const one = await resolveBranch('902', me.id, [VIEW_ALL_BRANCHES], false);
		expect(one.active).toBe(902);
		expect(one.showSelector).toBe(true);

		const all = await resolveBranch('all', me.id, [VIEW_ALL_BRANCHES], false);
		expect(all.active, 'null means no branch predicate').toBeNull();
	});

	it('falls back to the home branch rather than erroring on a stale cookie', async () => {
		const me = await someUser();
		// A branch that was deleted, or never existed.
		const scope = await resolveBranch('99999', me.id, [VIEW_ALL_BRANCHES], false);

		expect(scope.active).toBe(me.branchId);
	});
});
