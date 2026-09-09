<script lang="ts">
	import * as Collapsible from '$lib/components/ui/collapsible/index.js';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import { cn } from 'tailwind-variants';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import { sidebarMenuButtonVariants } from './ui/sidebar/sidebar-menu-button.svelte';

	import { Button } from '$lib/components/ui/button/index.js';

	import type { Component } from 'svelte';
	import type { IconProps } from '@lucide/svelte';

	let {
		items,
		closeSidebar
	}: {
		items: {
			title: string;
			url: string;
			// Same shape as the nested `icon` below — every caller passes a lucide
			// component here, so the old `boolean` made the whole nav array fail
			// to typecheck at the call site.
			icon?: Component<IconProps>;
			items?: {
				title: string;
				url: string;
				icon?: Component<IconProps>;
			}[];
		}[];
		// Sits alongside `items`, not inside an item: it is a prop of this
		// component, and nesting it left the destructured value untyped.
		closeSidebar?: () => void;
	} = $props();
	import { page } from '$app/state';

	function variantChecker(url: string) {
		const currentPath = page.url.pathname;

		// Special case for root dashboard
		if (url === '/dashboard') {
			return currentPath === '/dashboard';
		}

		// For other items, check if current path starts with their URL but is not just /dashboard
		return currentPath.startsWith(url) && currentPath !== '/dashboard';
	}
	function variantChecker2(url: string) {
		const currentPath = page.url.pathname;

		// Special case for root dashboard

		// For other items, check if current path starts with their URL but is not just /dashboard
		return currentPath === url;
	}

	let btnStyle = 'text-md w-full! justify-start pl-2! py-6 font-normal';
</script>

<Sidebar.Group>
	<Sidebar.Menu class="gap-2">
		{#each items as item (item.title)}
			{#if item.items}
				<Collapsible.Root class="group/collapsible">
					{#snippet child({ props })}
						<Sidebar.MenuItem {...props}>
							<Collapsible.Trigger>
								{#snippet child({ props })}
									<Button
										{...props}
										variant={variantChecker(item.url) ? 'default' : 'ghost'}
										size="lg"
										class={btnStyle}
										title="Goto {item.title}"
									>
										{#if item.icon}
											<item.icon class="h-5! w-5!" />
										{/if}
										<span>{item.title}</span>

										<ChevronRightIcon
											class="ms-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90"
										/>
									</Button>
								{/snippet}
							</Collapsible.Trigger>

							<Collapsible.Content>
								<Sidebar.MenuSub>
									{#each item.items ?? [] as subItem (subItem.title)}
										<Sidebar.MenuSubItem>
											<Button
												{...props}
												variant={variantChecker2(subItem.url) ? 'default' : 'ghost'}
												size="sm"
												onclick={closeSidebar}
												class="w-full! justify-start text-sm font-normal"
												href={subItem.url}
												title="Goto {subItem.title}"
											>
												{#if subItem.icon}
													<subItem.icon class="h-4 w-4" />
												{/if}
												<span>{subItem.title}</span>
											</Button>
										</Sidebar.MenuSubItem>
									{/each}
								</Sidebar.MenuSub>
							</Collapsible.Content>
						</Sidebar.MenuItem>
					{/snippet}
				</Collapsible.Root>
			{:else}
				<Sidebar.Menu class="w-full gap-3" title="Goto {item.title}">
					<Sidebar.MenuItem>
						<Button
							size="lg"
							class={btnStyle}
							href={item.url}
							onclick={closeSidebar}
							variant={variantChecker(item.url) ? 'default' : 'ghost'}
						>
							{#if item.icon}
								<item.icon class="h-5! w-5!" />
							{/if}
							<span>{item.title}</span>
						</Button>
					</Sidebar.MenuItem>
				</Sidebar.Menu>
			{/if}
		{/each}
	</Sidebar.Menu>
</Sidebar.Group>
