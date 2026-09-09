<script lang="ts">
	import LayoutMenu, { type MenuItem } from '$lib/components/LayoutMenu.svelte';
	import { Loader, CircleCheckBig, OctagonMinus } from '@lucide/svelte';

	let { children } = $props();

	const items: MenuItem[] = [
		{ title: 'Pending Leaves', href: '/dashboard/employees/leaves/pending', IconComp: Loader },
		{
			title: 'Approved Leaves',
			href: '/dashboard/employees/leaves/approved',
			IconComp: CircleCheckBig
		},
		{
			title: 'Cancelled Leaves',
			href: '/dashboard/employees/leaves/cancelled',
			IconComp: OctagonMinus
		}
	];
</script>

<LayoutMenu {items} />

{@render children()}
