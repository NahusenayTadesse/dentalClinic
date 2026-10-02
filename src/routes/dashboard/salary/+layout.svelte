<script lang="ts">
	import LayoutMenu, { type MenuItem } from '$lib/components/LayoutMenu.svelte';
	import { Sheet } from '@lucide/svelte';

	let { children } = $props();

	// Transactions and bank history carry permissions of their own, so this menu now spans three
	// of them — a salary user without `transactions.manage` is not offered that page.
	const items: MenuItem[] = [
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
			match: 'prefix'
		},
		{
			// One entry for the three adjustment ledgers: the page has its own tabs between them.
			title: 'Overtime, Bonuses & Deductions',
			href: '/dashboard/salary/ledger/overtime',
			IconComp: Sheet,
			match: (path) => path.startsWith('/dashboard/salary/ledger')
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
