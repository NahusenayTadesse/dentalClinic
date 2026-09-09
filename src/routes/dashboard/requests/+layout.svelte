<script lang="ts">
	import LayoutMenu, { type MenuItem } from '$lib/components/LayoutMenu.svelte';
	import { Loader, Plus, CircleCheckBig, OctagonMinus } from '@lucide/svelte';

	let { children } = $props();

	const items: MenuItem[] = [
		{ title: 'Add New Request', href: '/dashboard/requests/add-request', IconComp: Plus },
		{ title: 'Pending Requests', href: '/dashboard/requests/pending', IconComp: Loader },
		{ title: 'Approved Requests', href: '/dashboard/requests/approved', IconComp: CircleCheckBig },
		{ title: 'Cancelled Requests', href: '/dashboard/requests/cancelled', IconComp: OctagonMinus },
		{ title: 'Special Requests', href: '/dashboard/requests/special', IconComp: OctagonMinus }
	];
</script>

<LayoutMenu {items} />

{@render children()}
