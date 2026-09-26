<script lang="ts">
	import LayoutMenu, { type MenuItem } from '$lib/components/LayoutMenu.svelte';
	import { Calendar, Plus, Sheet, TreePalm } from '@lucide/svelte';

	let { children } = $props();

	const items: MenuItem[] = [
		{ title: 'All Active Employees', href: '/dashboard/employees', IconComp: Sheet },
		{
			title: 'All Inactive Employees',
			href: '/dashboard/employees/inactive',
			IconComp: Sheet,
			tone: 'destructive'
		},
		{ title: 'Add New Employee', href: '/dashboard/employees/add-employee', IconComp: Plus },
		{ title: 'Leaves', href: '/dashboard/employees/leaves', IconComp: TreePalm, match: 'prefix' },
		{
			title: 'Attendance',
			href: '/dashboard/employees/attendance',
			IconComp: Calendar,
			match: 'prefix'
		}
	];
</script>

<LayoutMenu {items} />

{@render children()}
