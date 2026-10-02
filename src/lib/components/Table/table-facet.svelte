<script lang="ts">
	import Check from '@lucide/svelte/icons/check';
	import Filter from '@lucide/svelte/icons/filter';
	import * as Popover from '@nahu/admin-kit/components/ui/popover/index.js';
	import * as Command from '@nahu/admin-kit/components/ui/command/index.js';
	import { Badge } from '@nahu/admin-kit/components/ui/badge/index.js';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import type { Facet } from '@nahu/admin-kit/components/Table/table-state.svelte.js';

	/**
	 * The filter for one column, living in that column's header.
	 *
	 * It sits here rather than in a separate bar because the header is where the reader already
	 * is when they decide to narrow a column — the old arrangement made them look away from the
	 * data, open a panel, find the column's name again, and come back.
	 *
	 * `multi` is not cosmetic. In client mode several values can be selected at once because the
	 * filtering happens over rows already in memory. In server mode `parseTableQuery` reads one
	 * string per key, so choosing a value replaces the previous one; rendering a multi-select
	 * there would promise something the URL cannot carry.
	 */
	let {
		label,
		facets,
		selected = [],
		multi = true,
		onToggle,
		onClear
	}: {
		label: string;
		facets: Facet[];
		selected?: string[];
		multi?: boolean;
		onToggle: (value: string) => void;
		onClear: () => void;
	} = $props();

	let open = $state(false);

	const total = $derived(facets.reduce((sum, f) => sum + f.count, 0));
</script>

{#if facets.length}
	<Popover.Root bind:open>
		<Popover.Trigger>
			{#snippet child({ props })}
				<Button
					{...props}
					variant="ghost"
					size="sm"
					class="h-7 gap-1 px-1.5 data-[active=true]:text-primary"
					data-active={selected.length > 0}
					aria-label="Filter by {label}"
				>
					<Filter class="size-3.5" />
					{#if selected.length}
						<Badge variant="secondary" class="px-1 py-0 text-[10px]">{selected.length}</Badge>
					{/if}
				</Button>
			{/snippet}
		</Popover.Trigger>

		<Popover.Content class="w-60 p-0" align="start">
			<Command.Root>
				<Command.Input placeholder="Filter {label.toLowerCase()}…" />
				<Command.List>
					<Command.Empty>No values.</Command.Empty>
					<Command.Group>
						{#each facets as facet (facet.value)}
							{@const isOn = selected.includes(facet.value)}
							<Command.Item
								value={facet.label}
								onSelect={() => {
									onToggle(facet.value);
									if (!multi) open = false;
								}}
							>
								<div
									class="mr-2 flex size-4 items-center justify-center rounded-sm border border-primary
										{isOn ? 'bg-primary text-primary-foreground' : 'opacity-50'}"
								>
									{#if isOn}<Check class="size-3" />{/if}
								</div>
								<!-- The label is shown; `facet.value` is what the filter actually sends. -->
								<span class="truncate">{facet.label}</span>
								<!-- The tally is the point: it says what narrowing will cost before you commit. -->
								<span class="ml-auto pl-2 font-mono text-xs text-muted-foreground">
									{facet.count.toLocaleString()}
								</span>
							</Command.Item>
						{/each}
					</Command.Group>

					{#if selected.length}
						<Command.Separator />
						<Command.Group>
							<Command.Item
								onSelect={() => {
									onClear();
									open = false;
								}}
							>
								<span class="w-full text-center text-sm">Clear {label.toLowerCase()}</span>
							</Command.Item>
						</Command.Group>
					{/if}
				</Command.List>
			</Command.Root>

			<div class="border-t px-3 py-1.5 text-[11px] text-muted-foreground">
				{total.toLocaleString()} rows across {facets.length}
				{facets.length === 1 ? 'value' : 'values'}
			</div>
		</Popover.Content>
	</Popover.Root>
{/if}
