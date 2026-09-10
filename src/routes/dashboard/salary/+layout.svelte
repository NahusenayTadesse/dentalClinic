<script lang="ts">
	import LayoutMenu, { type MenuItem } from '$lib/components/LayoutMenu.svelte';
	import { Landmark, List, Sheet } from '@lucide/svelte';

	let { children } = $props();

	// Transactions and bank history carry permissions of their own, so this menu now spans three
	// of them — a salary user without `transactions.manage` is not offered that page.
	const items: MenuItem[] = [
		{ title: 'Branch List', href: '/dashboard/salary/add-payroll/branches', IconComp: List },
		{
			title: 'Paid Salary History',
			href: '/dashboard/salary',
			IconComp: Sheet,
			match: (path) =>
				path === '/dashboard/salary' || path.startsWith('/dashboard/salary/paid-salaries')
		},
		{
			title: 'Unpaid Salaries',
			href: '/dashboard/salary/add-payroll',
			IconComp: Sheet,
			match: (path) => path.includes('/dashboard/salary/add-payroll') && !path.includes('branches')
		},
		{
			title: 'All Overtime',
			href: '/dashboard/salary/add-overtime',
			IconComp: Sheet,
			match: 'prefix'
		},
		{
			title: 'All Deductions',
			href: '/dashboard/salary/add-deductions',
			IconComp: Sheet,
			match: 'prefix'
		},
		{
			title: 'Transactions',
			href: '/dashboard/salary/transactions',
			IconComp: Sheet,
			match: 'prefix'
		}
	];
</script>

<LayoutMenu {items} />

{@render children()}
