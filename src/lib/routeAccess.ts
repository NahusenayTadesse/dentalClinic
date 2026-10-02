/**
 * Route prefixes mapped to the permission they need — the single source of truth for who may
 * open what.
 *
 * `hooks.server.ts` enforces this on every request; the layout menus and the top bar read the
 * same list to decide what to render, so a button never leads somewhere the click would 403.
 * Order matters: the first matching prefix wins, so specific paths come before general ones.
 */
/**
 * The area that is closed by default. A path under here with no rule is refused (see
 * `ruleForPath`); a path outside it — `/login`, `/setup`, `/forgot-password` — is not this
 * module's business.
 */
export const PROTECTED_ROOT = '/dashboard';

export type RouteRule = {
	prefix: string;

	/**
	 * The permission the prefix sits behind, or `null` for "any signed-in user is enough".
	 *
	 * `null` is a decision on the record, not an absence of one. Because unmatched paths are
	 * refused, the only way a page becomes reachable without a permission is for somebody to
	 * write `null` here and mean it.
	 */
	permission: string | null;

	/**
	 * Match the path exactly rather than as a prefix.
	 *
	 * Only `/dashboard` itself needs this, and it needs it badly: as a prefix rule it would match
	 * every page in the app and hand default-deny back to default-allow in one line.
	 */
	exact?: boolean;
};

export const routeRules: RouteRule[] = [
	/*
	 * Reachable by anyone with an account, on purpose.
	 *
	 * Everything below carries a permission; these four do not, because refusing them would be
	 * refusing people the things an account *is*: the page it lands on, the ability to change
	 * your own password, the manual, and the attachments already on records you can open.
	 */
	{ prefix: '/dashboard', permission: null, exact: true },
	{ prefix: '/dashboard/change-password', permission: null },
	{ prefix: '/dashboard/help', permission: null },
	// Switching branch is not a privilege: everyone works somewhere, and `resolveBranch`
	// already refuses a branch the caller may not see.
	{ prefix: '/dashboard/branch', permission: null },
	// The store is flat and a filename records nothing about what it is attached to, so there is
	// nothing here to check a permission against — see the note on the route itself.
	{ prefix: '/dashboard/files/', permission: null },

	{
		prefix: '/dashboard/admin-panel/users',
		permission: 'users.manage'
	},
	{
		prefix: '/dashboard/admin-panel/roles',
		permission: 'roles.manage'
	},
	{
		prefix: '/dashboard/admin-panel',
		permission: 'settings.manage'
	},

	{
		prefix: '/dashboard/customers',
		permission: 'customers.record'
	},

	/*
	 * Patients are where reading and changing a record split (CLAUDE.md §9). The route rule is the
	 * floor — who may open a chart at all — and it is deliberately the broad one, because the front
	 * desk has to find people. Changing a chart is checked on each action: `patients.edit` for who
	 * someone is and how to reach them, `patients.clinical` for allergies, conditions, medicines
	 * and the history. Both are in `CODE_ONLY_PERMISSIONS`, since no path carries them.
	 *
	 * Registering is its own page and its own rule, so it must come before the general prefix.
	 */
	/*
	 * The clinicians. Their licences decide who may legally treat, so this sits with the people who
	 * manage staff rather than with the front desk that books them.
	 */
	{
		prefix: '/dashboard/providers',
		permission: 'providers.manage'
	},

	/*
	 * The diary. Opening it is `appointments.view`; booking, moving, cancelling and changing a
	 * status is `appointments.book`, checked in each action (code-only, like the patient writes) —
	 * those actions are also posted from the patient chart, which this rule does not cover.
	 */
	{
		prefix: '/dashboard/appointments',
		permission: 'appointments.view'
	},

	/*
	 * Recalls: the list of patients due back, worked by whoever books appointments — a recall is
	 * answered by a booking, and the list's only writes are logging a call and booking.
	 */
	{
		prefix: '/dashboard/recalls',
		permission: 'appointments.book'
	},

	/*
	 * Lab work: the board of cases out at laboratories, overdue, and back to fit. Its own
	 * permission, because receiving a parcel from the courier and fitting what was in it is a
	 * different job from charting — often a nurse's or the front desk's. The patient's Lab work tab
	 * sits under `/dashboard/patients` and checks the same permission in each action.
	 */
	{
		prefix: '/dashboard/lab-cases',
		permission: 'lab_cases.manage'
	},

	/*
	 * Treatment plans: the follow-up list of quotes awaiting an answer, and — checked in each action
	 * on the patient's plans tab, which sits under `/dashboard/patients` — drawing up a plan,
	 * presenting it and recording the answer. Reading a patient's plans is the chart's own
	 * `patients.view`; this is who runs case acceptance, often a treatment coordinator rather
	 * than the dentist.
	 */
	{
		prefix: '/dashboard/treatment-plans',
		permission: 'treatment_plans.manage'
	},

	/*
	 * Billing. The drawer is its own permission, and its prefix comes first: counting the cash is
	 * a different trust from raising a bill — often a manager's, at the end of the day. Raising a
	 * bill and taking payment on a patient's chart is checked in each action there, under the same
	 * `billing.invoice`, since the chart's own rule is only `patients.view`. Discounts and voids
	 * are settled through `approvals.approve`, not here.
	 */
	{
		prefix: '/dashboard/billing/cash',
		permission: 'billing.cash_session'
	},
	{
		prefix: '/dashboard/billing',
		permission: 'billing.invoice'
	},

	{
		prefix: '/dashboard/patients/add',
		permission: 'patients.register'
	},
	{
		prefix: '/dashboard/patients',
		permission: 'patients.view'
	},

	{
		prefix: '/dashboard/employees/leaves',
		permission: 'leaves.view_approved'
	},
	// The trailing slash is load-bearing: it matches a queue page and not the index, so a
	// viewer sees what is waiting while only an approver can open the queue that settles it.
	{
		prefix: '/dashboard/approvals/',
		permission: 'approvals.approve'
	},
	{
		prefix: '/dashboard/approvals',
		permission: 'approvals.view'
	},
	// A separate desk from approvals — clearing rejections is its own job, held by its own people.
	{
		prefix: '/dashboard/rejections',
		permission: 'rejections.view'
	},
	// A database backup is the whole system in one file, so it sits with the settings that
	// decide how the system runs rather than being open to anyone who can reach the dashboard.
	{
		prefix: '/dashboard/backup',
		permission: 'settings.manage'
	},
	{
		prefix: '/dashboard/employees/attendance',
		permission: 'attendance.manage'
	},
	{
		prefix: '/dashboard/employees',
		permission: 'employees.create_followup'
	},

	// Both live under /dashboard/salary, so these must come before the salary rule below.
	{
		prefix: '/dashboard/salary/transactions',
		permission: 'transactions.manage'
	},
	{
		prefix: '/dashboard/salary',
		permission: 'salary.manage'
	},

	{
		prefix: '/dashboard/supplies',
		permission: 'supplies_suppliers.manage'
	},

	// One rule per report page. The slugs are the real routes — the earlier `finance`, `hr` and
	// `customers-sites` prefixes named pages that never existed, so every report was falling
	// through to the catch-all and `reports.hr` bought nothing.
	{
		prefix: '/dashboard/reports/people',
		permission: 'reports.hr'
	},
	{
		prefix: '/dashboard/reports/leave',
		permission: 'reports.hr'
	},
	{
		prefix: '/dashboard/reports/system',
		permission: 'audit_logs.view'
	},
	{
		prefix: '/dashboard/reports/payroll',
		permission: 'reports.finance'
	},
	{
		prefix: '/dashboard/reports/compensation',
		permission: 'reports.finance'
	},
	{
		prefix: '/dashboard/reports/money',
		permission: 'reports.finance'
	},
	{
		prefix: '/dashboard/reports/stock',
		permission: 'reports.finance'
	},
	/*
	 * The clinic report: production per dentist, case acceptance, recalls, receivables, the cash
	 * drawer and lab work. Its own permission because it is the practice owner's view of the
	 * clinical side, and the HR and finance report holders are a different audience — a payroll
	 * officer has no business with case acceptance, nor a clinical lead with salaries.
	 */
	{
		prefix: '/dashboard/reports/clinic',
		permission: 'reports.clinic'
	},
	// Last, so the three specific report prefixes above still win: `find` takes
	// the first match. The company report reads payroll and revenue
	// balances, so it sits behind the same permission the sidebar link declares.
	{
		prefix: '/dashboard/reports',
		permission: 'reports.finance'
	}
];

/**
 * The rule governing `pathname`, or `undefined` when no rule claims it.
 *
 * First match wins, so specific prefixes must come before general ones — that ordering is load
 * bearing and the array says so where it matters.
 */
export function ruleForPath(pathname: string): RouteRule | undefined {
	return routeRules.find((rule) =>
		rule.exact
			? pathname === rule.prefix || pathname === rule.prefix + '/'
			: pathname.startsWith(rule.prefix)
	);
}

/** The permission `pathname` sits behind, or undefined when it needs none (or has no rule). */
export function permissionForPath(pathname: string): string | undefined {
	return ruleForPath(pathname)?.permission ?? undefined;
}

/**
 * Whether this user may open `pathname`. Menus call this rather than naming a permission of
 * their own — a link and the gate in front of it cannot then drift apart.
 *
 * **Closed by default.** A path under `/dashboard` that no rule claims returns `false`, which is
 * the whole point: the app grew 96 pages against 22 rules, so a new clinical route was readable
 * by every account until somebody remembered to gate it. Forgetting is now a 403 on the first
 * click instead of a hole nobody sees. Paths outside `/dashboard` are not gated here.
 */
export function canVisit(pathname: string, permList: string[] | undefined | null): boolean {
	if (!pathname.startsWith(PROTECTED_ROOT)) return true;

	const rule = ruleForPath(pathname);
	if (!rule) return false;
	if (rule.permission === null) return true;

	return (permList ?? []).includes(rule.permission);
}
