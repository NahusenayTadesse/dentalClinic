<script lang="ts">
	import * as Menubar from '@nahu/admin-kit/components/ui/menubar/index.js';
	import { selectItem } from '$lib/global.svelte';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import { fly, slide } from 'svelte/transition';
	import { canVisit } from '$lib/routeAccess';
	import { viewer } from '$lib/viewer.svelte';
	import { settingsSections, type NavItem } from '$lib/navigation';

	let { children } = $props();

	// The same sections as the index page and the same rule as the server gate, so a screen a
	// viewer may not open is not offered, and the menus cannot drift from the sidebar.
	const me = viewer();
	let sections = $derived(settingsSections((url) => canVisit(url, me.permList)));
</script>

{#snippet menu(trigger: string, items: NavItem[])}
	<Menubar.Menu>
		<Menubar.Trigger class={selectItem}>{trigger} <ChevronDown /></Menubar.Trigger>

		<div transition:fly={{ y: 20, duration: 300 }}>
			<Menubar.Content>
				{#each items as item (item.url)}
					<Menubar.Item class={selectItem}
						><a href={item.url} class="w-full" transition:slide|global>{item.title}</a
						></Menubar.Item
					>
					<Menubar.Separator />
				{/each}
			</Menubar.Content>
		</div>
	</Menubar.Menu>
{/snippet}

<Menubar.Root class="sticky mb-8 bg-transparent">
	{#each sections as section (section.key)}
		{@render menu(section.title, section.items)}
	{/each}
</Menubar.Root>

{@render children?.()}
