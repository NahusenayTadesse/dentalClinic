/**
 * Which branch the user is working at, and what that scopes.
 *
 * **Branch is context, not a filter.** A filter narrows within a context; the branch you are
 * working at *is* the context. It was briefly a column filter and a chart facet on every
 * branch-aware list, which put the same decision on twenty-one loaders and let them disagree.
 * It is chosen once, in the top bar, and every query reads it from here.
 *
 * A clinic with one branch never sees any of it: the selector does not render, the cookie is
 * irrelevant, and the scope resolves to the only branch there is.
 *
 * ## The three rules that make this safe
 *
 * 1. **The cookie is re-validated on every request.** It is client-controlled, so `resolveBranch`
 *    checks that the branch exists and that this user may see it. Without that check a manager
 *    at one branch edits a cookie and reads another branch's patients — the whole feature becomes
 *    an access-control hole rather than a convenience.
 * 2. **Scope is a closed list, not "has a `branch_id` column".** Eighteen tables carry one and
 *    most must not be filtered by it. See `BRANCH_SCOPED` below.
 * 3. **Writes are stamped, not defaulted.** `branchRef()` defaults to `MAIN_BRANCH_ID`, so a
 *    record created while working at a second branch would otherwise be filed under the first.
 *    Creates set `branchId` from `locals.branch.active`.
 */
import { and, count, eq, isNull } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { branch } from '$lib/server/db/schema/branches';
import { user } from '$lib/server/db/schema/user';
import { notDeleted } from '$lib/server/softDelete';

/** Holders see every branch and may pick "All branches"; everyone else is pinned to their own. */
export const VIEW_ALL_BRANCHES = 'branches.view_all';

/** The cookie carrying the choice. Readable by the client only so the selector can show itself. */
export const BRANCH_COOKIE = 'clinic_branch';

/** "All branches", for a user allowed to see across them. */
export const ALL_BRANCHES = 'all';

/**
 * What a branch selection actually narrows.
 *
 * **Deliberately shorter than "tables with a `branch_id`".** Three kinds are excluded and each
 * for its own reason:
 *
 * - **Reference data** — allergens, conditions, appointment types, contact types, specialties,
 *   dental labs. A clinic's formulary is the clinic's, not a location's. Scoping these would
 *   empty half the pickers at the second branch.
 * - **`patient` itself** — a patient treated at one branch must be findable at another, without
 *   being re-registered. The *list* is scoped and the *search* is not; see `patientScope`.
 * - **`audit_log` and `patient_access_log`** — these record *where something happened*. Filtering
 *   evidence by the branch you happen to be sitting at is how you fail to find the thing you are
 *   looking for.
 *
 * Adding a table here is a decision about who can see what, so it is made once, here, in the
 * open — not inferred from a column name.
 */
export const BRANCH_SCOPED = [
	'appointment',
	'procedures',
	'invoice',
	'transactions',
	'expenses',
	'cash_session',
	'prescription',
	'lab_case',
	'recall',
	'treatment_plan',
	'supplies_adjustments',
	'supply_batch',
	'attendance',
	'employee'
] as const;

export type BranchScopedTable = (typeof BRANCH_SCOPED)[number];

/** What every request knows about the branch it is being served for. */
export type BranchContext = {
	/** The branch to scope by, or `null` for "all branches". */
	active: number | null;
	/** Every branch this user may choose between. One entry is the ordinary case. */
	options: { id: number; name: string }[];
	/** Whether this user may see across branches at all. */
	canSeeAll: boolean;
	/** Render the selector only when there is a genuine choice to make. */
	showSelector: boolean;
};

/**
 * Resolves the branch for one request, from the cookie and the user.
 *
 * The cookie is a *request*, not an answer: what comes back is the intersection of what was asked
 * for and what this user is allowed. An unknown id, a deleted branch, or `all` without the
 * permission all fall back to the user's own branch rather than erroring — a stale cookie should
 * not lock somebody out of the app.
 */
export async function resolveBranch(
	requested: string | undefined,
	userId: string | undefined,
	permList: string[],
	isSuperAdmin: boolean
): Promise<BranchContext> {
	const canSeeAll = isSuperAdmin || permList.includes(VIEW_ALL_BRANCHES);

	const branches = await db
		.select({ id: branch.id, name: branch.name })
		.from(branch)
		.where(notDeleted(branch))
		.orderBy(branch.name);

	// Whose branch they are pinned to when they may not roam.
	let home: number | null = null;

	if (userId) {
		const [row] = await db
			.select({ branchId: user.branchId })
			.from(user)
			.where(eq(user.id, userId))
			.limit(1);
		home = row?.branchId ?? null;
	}

	const options = canSeeAll ? branches : branches.filter((b) => b.id === home);

	let active: number | null;

	if (canSeeAll && requested === ALL_BRANCHES) {
		active = null;
	} else {
		const asked = Number(requested);
		const allowed = options.some((b) => b.id === asked);

		/*
		 * The validation that matters: a cookie naming a branch this user may not see is ignored.
		 *
		 * Falling back to their *own* branch rather than the first in the list — a manager who has
		 * not chosen anything should land where they work, not wherever the alphabet puts them.
		 */
		const fallback = options.some((b) => b.id === home) ? home : (options[0]?.id ?? null);
		active = allowed ? asked : fallback;
	}

	return {
		active,
		options,
		canSeeAll,
		// Nothing to choose between: one branch, or one branch this user may see.
		showSelector: options.length > 1
	};
}

/**
 * The condition that scopes a branch-aware query, or `undefined` for "all branches".
 *
 *     .where(and(notDeleted(appointment), branchFilter(appointment.branchId, locals.branch)))
 *
 * Undefined rather than a no-op condition so it drops out of `and(...)` cleanly.
 */
export function branchFilter(
	column: Parameters<typeof eq>[0],
	context: Pick<BranchContext, 'active'>
) {
	if (context.active === null) return undefined;
	return eq(column, context.active);
}

/**
 * Patients are the exception, and the reason is worth stating where it cannot be missed.
 *
 * **The list is scoped; the search is not.** Browsing shows this branch's patients, because a
 * roster of everybody who has ever attended the clinic is exactly the sensitive bulk that should
 * not be idly readable from a reception desk. Searching crosses branches, because a patient who
 * turns up at the other location must be found rather than registered twice — and a deliberate
 * search for a named person is a different act from paging through a list.
 *
 * A result from elsewhere is shown with `fromOtherBranch` set, so the screen can say what it is:
 * *this patient is not from this branch, but can be treated here.* Reading one is exactly the
 * kind of access `patient_access_log` exists to record.
 *
 * Do not "simplify" these into one rule. They are two on purpose.
 */
export function patientScope(
	column: Parameters<typeof eq>[0],
	context: Pick<BranchContext, 'active'>,
	mode: 'list' | 'search'
) {
	return mode === 'search' ? undefined : branchFilter(column, context);
}

/** How many branches exist at all — for the one-branch shortcut, and for `/setup`. */
export async function branchCount(): Promise<number> {
	const [row] = await db
		.select({ total: count() })
		.from(branch)
		.where(and(isNull(branch.deletedAt)));
	return Number(row?.total ?? 0);
}
