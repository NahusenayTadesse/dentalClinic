/**
 * Route prefixes mapped to the permission they need — the single source of truth for who may
 * open what.
 *
 * `hooks.server.ts` enforces this on every request; the layout menus and the top bar read the
 * same list to decide what to render, so a button never leads somewhere the click would 403.
 * Order matters: the first matching prefix wins, so specific paths come before general ones.
 */
export type RouteRule = { prefix: string; permission: string };

export const routeRules: RouteRule[] = [
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
		permission: 'customers_sites.record'
	},

	{
		prefix: '/dashboard/sites',
		permission: 'customers_sites.record'
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
		prefix: '/dashboard/employees/sites',
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
		prefix: '/dashboard/salary/bank-history',
		permission: 'bank_history.view'
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
	// Last, so the three specific report prefixes above still win: `find` takes
	// the first match. The company report reads payroll, revenue and bank
	// balances, so it sits behind the same permission the sidebar link declares.
	{
		prefix: '/dashboard/reports',
		permission: 'reports.finance'
	}
];

/** The permission `pathname` sits behind, or undefined when the path is open to any user. */
export function permissionForPath(pathname: string): string | undefined {
	return routeRules.find((rule) => pathname.startsWith(rule.prefix))?.permission;
}

/**
 * Whether this user may open `pathname`. Menus call this rather than naming a permission of
 * their own — a link and the gate in front of it cannot then drift apart.
 */
export function canVisit(pathname: string, permList: string[] | undefined | null): boolean {
	const permission = permissionForPath(pathname);
	if (!permission) return true;
	return (permList ?? []).includes(permission);
}
