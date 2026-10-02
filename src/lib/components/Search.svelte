<script lang="ts">
	import * as Command from '@nahu/admin-kit/components/ui/command/index.js';
	import Disc from '@lucide/svelte/icons/disc';
	import SearchIcon from '@lucide/svelte/icons/search';
	import DialogComp from '@nahu/admin-kit/formComponents/DialogComp.svelte';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import { searchEntries } from '$lib/navigation';
	import { canVisit } from '$lib/routeAccess';

	/** The viewer's permissions, from the dashboard layout — the same list the sidebar gets. */
	let { permList = [] }: { permList?: string[] } = $props();

	let isOpen = $state(false);

	// The sidebar's own list, flattened, so the palette cannot offer a page the menu does not
	// know about — or one this viewer would be refused. See `$lib/navigation.ts`.
	let list = $derived(searchEntries((url) => canVisit(url, permList)));
</script>

<DialogComp title="Search the Whole Site" variant="ghost" bind:open={isOpen}>
	{#snippet trigger(props)}
		<Button size="sm" variant="ghost" class="w-auto px-4" title="Search for Pages" {...props}>
			<SearchIcon />
		</Button>
	{/snippet}
	<Command.Root class="rounded-lg shadow-md md:min-w-112.5">
		<Command.Input placeholder="Type a command or search..." type="search" />
		<Command.List>
			<Command.Empty>No results found.</Command.Empty>
			<Command.Group heading="Suggestions">
				{#each list as item (item.url)}
					<Command.Item>
						<Disc />
						<a href={item.url} onclick={() => (isOpen = false)}>{item.label}</a>
					</Command.Item>
				{/each}
			</Command.Group>
		</Command.List>
	</Command.Root>
</DialogComp>
