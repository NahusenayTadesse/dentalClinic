<script lang="ts">
	import * as Sidebar from '@nahu/admin-kit/components/ui/sidebar/index.js';
	import type { ComponentProps } from 'svelte';
	import { appSurface } from '$lib/global.svelte';
	import Logo from '$lib/components/Logo.svelte';
	import { useSidebar } from '@nahu/admin-kit/components/ui/sidebar/index.js';
	import { canVisit } from '$lib/routeAccess';
	import { NAVIGATION, type NavItem } from '$lib/navigation';

	import NavMain from './NavMain.svelte';

	let {
		permList = [],
		...restProps
	}: { permList?: string[] } & ComponentProps<typeof Sidebar.Root> = $props();

	// The same rule the server gate applies, read off the link's own URL. Nothing here names a
	// permission of its own any more, so a menu entry and the gate in front of it cannot drift
	// apart — an ungated URL (the dashboard index) stays open to everyone.
	function hasAccess(item: NavItem): boolean {
		return canVisit(item.url, permList);
	}
	const sidebar = useSidebar();

	function closeSidebar() {
		if (sidebar.isMobile) {
			sidebar.setOpenMobile(false);
		}
	}
	const filteredNavigation = $derived.by(() => {
		return NAVIGATION.map((item) => {
			// 1. If the user fails the parent-level permission, drop the item instantly
			if (!hasAccess(item)) return null;

			// 2. If it has sub-items, clean and filter them recursively
			if (item.items) {
				const allowedSubItems = item.items.filter(hasAccess);

				// If a parent module has no accessible children left, remove it from view
				if (allowedSubItems.length === 0) return null;

				return { ...item, items: allowedSubItems };
			}

			return item;
		}).filter((item): item is NavItem => item !== null);
	});
</script>

<Sidebar.Root collapsible="offcanvas" {...restProps}>
	<Sidebar.Content
		class="z-9999! h-full
  [scrollbar-width:thin] [scrollbar-color:#a3a3a3_transparent]
  overflow-y-scroll
  pt-4
  [&::-webkit-scrollbar]:w-2
  [&::-webkit-scrollbar-thumb]:bg-gray-400
  [&::-webkit-scrollbar-thumb:hover]:bg-gray-500 [&::-webkit-scrollbar-track]:bg-transparent
  {appSurface}
"
	>
		<Sidebar.Group>
			<Sidebar.GroupLabel>
				<div class="flex w-full flex-row items-center justify-start px-1">
					<Logo class="h-14" />
				</div></Sidebar.GroupLabel
			>
			<Sidebar.GroupContent class="my-4">
				<NavMain {closeSidebar} items={filteredNavigation} />
			</Sidebar.GroupContent>
		</Sidebar.Group>
	</Sidebar.Content>
	<Sidebar.Footer class="flex flex-row border-t bg-sidebar">
		<Sidebar.GroupLabel>Powered by amno ERP Solutions</Sidebar.GroupLabel>
	</Sidebar.Footer>
</Sidebar.Root>
