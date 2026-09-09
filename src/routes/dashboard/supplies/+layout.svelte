<script lang="ts">
	import LayoutMenu, { type MenuItem } from '$lib/components/LayoutMenu.svelte';
	import { PackagePlus, Plus, Sheet, Tags, Truck } from '@lucide/svelte';

	let { children } = $props();

	const items: MenuItem[] = [
		{ title: 'All Supplies', href: '/dashboard/supplies', IconComp: Sheet },
		{ title: 'Add Supplies', href: '/dashboard/supplies/add-supplies', IconComp: Plus },
		{ title: 'Site Leases', href: '/dashboard/supplies/leases', IconComp: Truck },
		{
			title: 'Lease to Site',
			href: '/dashboard/supplies/leases/add-lease',
			IconComp: PackagePlus
		},
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
