<script lang="ts">
	import * as Select from '$lib/components/ui/select/index.js';
	import { selectItem, type Item } from '$lib/global.svelte';

	// `onValueChange` is optional and simply forwarded to `Select.Root`. It lets a
	// caller react to a change without binding, which the query builder needs:
	// picking a different field has to reset that row's operator and operands.
	let {
		value = $bindable(),
		items,
		name,
		/**
		 * What the empty trigger says to pick — the field's own label, when the caller has one.
		 *
		 * Without it the placeholder is built from the column name, so a foreign key read "Select
		 * Provider Id" and "Select Operatory Id" on the booking form. Defaulting to the old
		 * behaviour keeps every existing caller unchanged.
		 */
		label = undefined,
		onValueChange = undefined
	} = $props();
	const triggerContent = $derived(
		// Use String coercion to ensure "1" matches 1
		items.find((f: Item) => String(f.value) === String(value))?.name ??
			'Select ' + (label ?? name.replace(/([a-z])([A-Z])/g, '$1 $2'))
	);
</script>

<Select.Root type="single" {name} bind:value {onValueChange}>
	<Select.Trigger class="w-full capitalize">
		{triggerContent}
	</Select.Trigger>
	<Select.Content>
		{#each items as item (item.value)}
			<Select.Item value={item.value} class={selectItem}>{item.name}</Select.Item>
		{/each}
	</Select.Content>
</Select.Root>
