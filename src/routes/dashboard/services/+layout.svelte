<script lang="ts">
	import LayoutMenu, { type MenuItem } from '$lib/components/LayoutMenu.svelte';
	import { Sheet } from '@lucide/svelte';

	let { children } = $props();

	// Lives in the admin panel, so it disappears for anyone without settings access.
	const items: MenuItem[] = [
		{
			title: 'Services Categories',
			href: '/dashboard/admin-panel/services/categories',
			IconComp: Sheet
		}
	];
</script>

<LayoutMenu {items} />

{@render children?.()}
