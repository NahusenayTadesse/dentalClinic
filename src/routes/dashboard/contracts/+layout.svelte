<script lang="ts">
	import LayoutMenu, { type MenuItem } from '$lib/components/LayoutMenu.svelte';
	import { Plus, Sheet } from '@lucide/svelte';

	let { children } = $props();

	const items: MenuItem[] = [
		{ title: 'Add New Contract', href: '/dashboard/contracts/add-contract', IconComp: Plus },
		{ title: 'Active Contracts', href: '/dashboard/contracts', IconComp: Sheet },
		{
			title: 'Inactive Contracts',
			href: '/dashboard/contracts/inactive',
			IconComp: Sheet,
			tone: 'destructive'
		},
		{
			title: 'Terminated Contracts',
			href: '/dashboard/contracts/terminated',
			IconComp: Sheet,
			tone: 'destructive'
		}
	];
</script>

<LayoutMenu {items} />

{@render children()}
