<script lang="ts">
	import * as Command from '@nahu/admin-kit/components/ui/command/index.js';
	import Disc from '@lucide/svelte/icons/disc';
	import SearchIcon from '@lucide/svelte/icons/search';
	import DialogComp from '@nahu/admin-kit/formComponents/DialogComp.svelte';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import { searchEntries } from '$lib/navigation';
	import { canVisit } from '$lib/routeAccess';
	import { useI18n } from '$lib/i18n/i18n.svelte';
	import { navTitle } from '$lib/i18n/messages';

	/** The viewer's permissions, from the dashboard layout — the same list the sidebar gets. */
	let { permList = [] }: { permList?: string[] } = $props();

	const t = useI18n();
	let isOpen = $state(false);

	// The sidebar's own list, flattened, so the palette cannot offer a page the menu does not
	// know about — or one this viewer would be refused. See `$lib/navigation.ts`. Each part of a
	// "Group › Page" label is translated; the English stays as a keyword, so typing either finds it.
	let list = $derived(
		searchEntries((url) => canVisit(url, permList)).map((entry) => ({
			...entry,
			shown: entry.label
				.split(' › ')
				.map((part) => navTitle(t.m, part))
				.join(' › ')
		}))
	);
</script>

<DialogComp title={t.m.common.searchTitle} variant="ghost" bind:open={isOpen}>
	{#snippet trigger(props)}
		<Button
			size="sm"
			variant="ghost"
			class="w-auto px-4"
			title={t.m.common.searchButton}
			aria-label={t.m.common.searchButton}
			{...props}
		>
			<SearchIcon />
		</Button>
	{/snippet}
	<Command.Root class="rounded-lg shadow-md md:min-w-112.5">
		<Command.Input placeholder={t.m.common.searchPlaceholder} type="search" />
		<Command.List>
			<Command.Empty>{t.m.common.searchEmpty}</Command.Empty>
			<Command.Group heading={t.m.common.searchSuggestions}>
				{#each list as item (item.url)}
					<Command.Item keywords={[item.label]}>
						<Disc />
						<a href={item.url} onclick={() => (isOpen = false)}>{item.shown}</a>
					</Command.Item>
				{/each}
			</Command.Group>
		</Command.List>
	</Command.Root>
</DialogComp>
