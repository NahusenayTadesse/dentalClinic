<script lang="ts">
	import LayoutMenu, { type MenuItem } from '$lib/components/LayoutMenu.svelte';
	import { Loader, Plus, CircleCheckBig, OctagonMinus } from '@lucide/svelte';

	let { children } = $props();

	const items: MenuItem[] = [
		{
			title: 'Add New Payment Collection',
			href: '/dashboard/payments/add-payment',
			IconComp: Plus
		},
		{ title: 'Pending Payments', href: '/dashboard/payments/pending', IconComp: Loader },
		{ title: 'Approved Payments', href: '/dashboard/payments/approved', IconComp: CircleCheckBig },
		{ title: 'Cancelled Payments', href: '/dashboard/payments/cancelled', IconComp: OctagonMinus }
	];
</script>

<LayoutMenu {items} />

{@render children()}
