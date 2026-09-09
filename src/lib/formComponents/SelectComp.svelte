<script lang="ts">
	import * as Select from '$lib/components/ui/select/index.js';
	import { selectItem, type Item } from '$lib/global.svelte';

	// `onValueChange` is optional and simply forwarded to `Select.Root`. It lets a
	// caller react to a change without binding, which the query builder needs:
	// picking a different field has to reset that row's operator and operands.
	let { value = $bindable(), items, name, onValueChange = undefined } = $props();
	function getItemNameById(items: any, value: any) {
		const item = items.find((i) => i.value === value);
		return item ? item.name : null; // returns null if not found
	}

	// const triggerContent = $derived(
	// 	items.find((f) => f.value === value)?.name ??
	// 		'Select ' + name.replace(/([a-z])([A-Z])/g, '$1 $2')
	// );
	//
	const triggerContent = $derived(
		// Use String coercion to ensure "1" matches 1
		items.find((f: Item) => String(f.value) === String(value))?.name ??
			'Select ' + name.replace(/([a-z])([A-Z])/g, '$1 $2')
	);
</script>

<Select.Root type="single" {name} bind:value {onValueChange}>
	<Select.Trigger class="w-full capitalize">
		{triggerContent}
	</Select.Trigger>
	<Select.Content>
		{#each items as item}
			<Select.Item value={item.value} class={selectItem}>{item.name}</Select.Item>
		{/each}
	</Select.Content>
</Select.Root>
