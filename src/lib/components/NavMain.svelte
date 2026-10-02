<script lang="ts">
	import * as Collapsible from '@nahu/admin-kit/components/ui/collapsible/index.js';
	import * as Sidebar from '@nahu/admin-kit/components/ui/sidebar/index.js';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';

	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';

	import type { NavItem } from '$lib/navigation';

	let {
		items,
		closeSidebar
	}: {
		/** Already filtered to what the viewer can open — see `app-sidebar.svelte`. */
		items: NavItem[];
		// Sits alongside `items`, not inside an item: it is a prop of this
		// component, and nesting it left the destructured value untyped.
		closeSidebar?: () => void;
	} = $props();
	import { page } from '$app/state';
	import { activeGroup } from '$lib/navigation';

	// One group lit at a time, chosen by the most specific link rather than a prefix — see
	// `activeGroup` for the pages a prefix test put under the wrong group.
	let current = $derived(activeGroup(items, page.url.pathname));

	function isCurrentPage(url: string) {
		return page.url.pathname === url;
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
										variant={current === item.title ? 'default' : 'ghost'}
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
												variant={isCurrentPage(subItem.url) ? 'default' : 'ghost'}
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
							variant={current === item.title ? 'default' : 'ghost'}
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
