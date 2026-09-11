<script lang="ts">
	import LayoutMenu, { type MenuItem } from '$lib/components/LayoutMenu.svelte';
	import { Plus, Sheet, Tags } from '@lucide/svelte';

	let { children } = $props();

	const items: MenuItem[] = [
		{ title: 'All Supplies', href: '/dashboard/supplies', IconComp: Sheet },
		{ title: 'Add Supplies', href: '/dashboard/supplies/add-supplies', IconComp: Plus },
		// Lives in the admin panel, so it disappears for anyone without settings access.
		{ title: 'Supply Types', href: '/dashboard/admin-panel/supply-types', IconComp: Tags },
		{ title: 'Suppliers', href: '/dashboard/supplies/suppliers', IconComp: Sheet },
		{
			title: 'Add Suppliers',
			href: '/dashboard/supplies/suppliers/add-suppliers',
			IconComp: Sheet
		}
	];
</script>

<LayoutMenu {items} />

{@render children?.()}
