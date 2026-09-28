<script lang="ts">
	import InputComp from '$lib/formComponents/InputComp.svelte';
	import type { SuperForm } from 'sveltekit-superforms';
	import type { z } from 'zod/v4';
	import { fly } from 'svelte/transition';
	import type { supplyItemSchema } from './add-supplies/schema';

	// The schema's input type, which is what both pages' forms arrive as: the coerced fields are
	// still `unknown` until they are parsed, and the output type would not accept them.
	type SupplyItem = z.input<typeof supplyItemSchema>;

	/**
	 * The fields of a stock item, shared by the add page and the item's edit form so the two cannot
	 * drift. They had been written out twice; the schema behind them was two copies too.
	 */
	let {
		form,
		errors,
		typeList
	}: {
		form: SuperForm<SupplyItem>['form'];
		errors: SuperForm<SupplyItem>['errors'];
		/** The supply types, for the item-type picker. */
		typeList: { value: string | number; name: string }[];
	} = $props();
</script>

<InputComp
	label="Item Name"
	name="name"
	type="text"
	required
	placeholder="Enter Supply Name"
	{errors}
	{form}
/>

<InputComp
	label="Item Type"
	name="supplyType"
	type="select"
	placeholder="Enter Item Type"
	{errors}
	{form}
	items={typeList}
/>

<InputComp
	label="Item Description"
	name="description"
	type="textarea"
	placeholder="Enter Supply Description"
	{errors}
	{form}
/>

<InputComp
	label="Unit of Measurement"
	name="unitOfMeasurement"
	type="select"
	placeholder="Enter Unit of Measurement"
	{errors}
	{form}
	items={[
		{ value: 'kg', name: 'Kilogram' },
		{ value: 'g', name: 'Gram' },
		{ value: 'ml', name: 'Milliliter' },
		{ value: 'l', name: 'Liter' },
		{ value: 'pcs', name: 'Piece' },
		{ value: 'other', name: 'Other' }
	]}
/>

{#if $form.unitOfMeasurement === 'other'}
	<div transition:fly={{ x: -20, duration: 300 }}>
		<InputComp
			label="Enter Other Unit of Measurement"
			name="otherUnitOfMeasurement"
			type="text"
			placeholder="Enter Other Unit of Measurement"
			{errors}
			{form}
		/>
	</div>
{/if}

<InputComp
	label="Expected Back"
	name="returnable"
	type="checkboxSingle"
	placeholder="Chased for return once issued — instruments and equipment, not consumables"
	{errors}
	{form}
/>

<InputComp
	label="Expires"
	name="tracksExpiry"
	type="checkboxSingle"
	placeholder="Goes off — every delivery must carry the date on the box, and the lot that expires soonest is used first"
	{errors}
	{form}
/>

<InputComp
	label="Reorder Notify Level"
	name="reorderLevel"
	type="number"
	placeholder="Enter when you want to be notified"
	{errors}
	{form}
/>
