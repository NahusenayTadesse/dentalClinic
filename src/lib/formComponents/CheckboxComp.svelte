<script lang="ts">
	import { Checkbox } from '@nahu/admin-kit/components/ui/checkbox/index.js';
	import { Input } from '@nahu/admin-kit/components/ui/input/index.js';
	import { Label } from '@nahu/admin-kit/components/ui/label/index.js';
	import { type Item } from '$lib/global.svelte';

	/**
	 * A checklist bound to an array of ids, with "Select all".
	 *
	 * `searchable` adds a box that narrows the list — for long lists such as every employee a pay
	 * adjustment can be recorded for. "Select all" then means all *shown*, and ticked items that
	 * the search hides stay ticked: narrowing the view must never quietly untick someone.
	 */
	let {
		items = [],
		checkedValues = $bindable(),
		searchable = false,
		id = 'checklist'
	}: {
		items: Item[];
		checkedValues?: string[] | number[];
		searchable?: boolean;
		/** Prefixes the boxes' ids, so two checklists on one page do not share them. */
		id?: string;
	} = $props();

	let term = $state('');

	const shown = $derived(
		term.trim()
			? items.filter((item) => String(item.name).toLowerCase().includes(term.trim().toLowerCase()))
			: items
	);

	const checked = $derived(new Set((checkedValues ?? []).map(String)));

	const handleChange = (itemValue: string, isChecked: boolean) => {
		const current = (checkedValues ?? []).map(String); // normalise for comparison
		if (isChecked) {
			checkedValues = [...current, itemValue].map(Number); // write back as numbers
		} else {
			checkedValues = current.filter((v) => v !== itemValue).map(Number);
		}
	};

	let allSelected = $derived(
		shown.length > 0 && shown.every((item) => checked.has(String(item.value)))
	);
	let someSelected = $derived(
		!allSelected && shown.some((item) => checked.has(String(item.value)))
	);

	function toggleSelectAll() {
		const ids = shown.map((item) => String(item.value));
		const others = [...checked].filter((v) => !ids.includes(v));
		checkedValues = (allSelected ? others : [...others, ...ids]).map(Number);
	}
</script>

{#if searchable}
	<Input type="search" placeholder="Search…" bind:value={term} aria-label="Search the list" />
{/if}

<div class="flex items-center justify-between gap-2 border-b pb-1">
	<Label for="{id}-all" class="flex cursor-pointer items-center gap-2 font-medium">
		<Checkbox
			id="{id}-all"
			checked={allSelected}
			indeterminate={someSelected}
			onCheckedChange={toggleSelectAll}
		/>
		{term.trim() ? `Select all ${shown.length} shown` : 'Select All'}
	</Label>
	{#if searchable}
		<span class="text-sm text-muted-foreground">{checked.size} chosen</span>
	{/if}
</div>

<div class="flex flex-col gap-2 {searchable ? 'max-h-64 overflow-y-auto' : ''}">
	{#each shown as item (item.value)}
		<div class="flex items-center gap-2">
			<Label for="{id}-{item.value}" class="cursor-pointer font-normal">
				<Checkbox
					id="{id}-{item.value}"
					checked={checked.has(String(item.value))}
					onCheckedChange={(c) => handleChange(String(item.value), c)}
				/>
				{item.name}
			</Label>
		</div>
	{:else}
		<p class="text-sm text-muted-foreground">Nothing matches.</p>
	{/each}
</div>
