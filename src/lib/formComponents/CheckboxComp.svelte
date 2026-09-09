<script lang="ts">
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { Label } from '$lib/components/ui/label';
	import { type Item } from '$lib/global.svelte';

	let {
		items = [],
		checkedValues = $bindable()
	}: { items: Item[]; checkedValues?: string[] | number[] } = $props();

	// const handleChange = (itemValue: string, isChecked: boolean) => {
	// 	const current = (checkedValues ?? []) as string[];
	// 	if (isChecked) {
	// 		checkedValues = [...current, itemValue];
	// 	} else {
	// 		checkedValues = current.filter((v) => v !== itemValue);
	// 	}
	// };

	// let allSelected = $derived((checkedValues ?? []).length === items.length && items.length > 0);
	// let someSelected = $derived((checkedValues ?? []).length > 0 && !allSelected);

	// function toggleSelectAll() {
	// 	if (allSelected) {
	// 		checkedValues = [];
	// 	} else {
	// 		checkedValues = items.map((item) => String(item.value));
	// 	}
	// }
	//
	const handleChange = (itemValue: string, isChecked: boolean) => {
		const current = (checkedValues ?? []).map(String); // normalise for comparison
		if (isChecked) {
			checkedValues = [...current, itemValue].map(Number); // write back as numbers
		} else {
			checkedValues = current.filter((v) => v !== itemValue).map(Number);
		}
	};

	let allSelected = $derived((checkedValues ?? []).length === items.length && items.length > 0);
	let someSelected = $derived((checkedValues ?? []).length > 0 && !allSelected);

	function toggleSelectAll() {
		if (allSelected) {
			checkedValues = [];
		} else {
			checkedValues = items.map((item) => Number(item.value)); // numbers here too
		}
	}
</script>

<div class="flex items-center gap-2 border-b pb-1">
	<Label for="select-all" class="flex cursor-pointer items-center gap-2 font-medium">
		<Checkbox
			id="select-all"
			checked={allSelected}
			indeterminate={someSelected}
			onCheckedChange={toggleSelectAll}
		/>
		Select All
	</Label>
</div>

<div class="flex flex-col gap-2">
	{#each items as item (item.value)}
		<div class="flex items-center gap-2">
			<Label for={String(item.value)} class="cursor-pointer font-normal">
				<Checkbox
					id={String(item.value)}
					checked={(checkedValues ?? []).map(String).includes(String(item.value))}
					onCheckedChange={(c) => handleChange(String(item.value), c)}
				/>
				{item.name}
			</Label>
		</div>
	{/each}
</div>
