<script lang="ts">
	import type { Snapshot } from '@sveltejs/kit';

	import LoadingBtn from '$lib/formComponents/LoadingBtn.svelte';

	import { Plus } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { zod4Client } from 'sveltekit-superforms/adapters';
	import { supplyItemSchema } from './schema';
	import { superForm } from 'sveltekit-superforms/client';
	import FormCard from '$lib/formComponents/FormCard.svelte';
	import InputComp from '$lib/formComponents/InputComp.svelte';
	import { fly } from 'svelte/transition';

	let { data } = $props();

	const { form, errors, enhance, delayed, capture, restore, message } = superForm(data.form, {
		taintedMessage: () => {
			return new Promise((resolve) => {
				resolve(window.confirm('Do you want to leave?\nChanges you made may not be saved.'));
			});
		},

		validators: zod4Client(supplyItemSchema)
	});

	import { toast } from 'svelte-sonner';
	$effect(() => {
		if ($message) {
			if ($message.type === 'error') {
				toast.error($message.text);
			} else {
				toast.success($message.text);
			}
		}
	});

	export const snapshot: Snapshot = { capture, restore };
</script>

<svelte:head>
	<title>Add New Supply Item</title>
</svelte:head>

<FormCard title="Add Supplies">
	<form use:enhance action="?/add" id="main" class="flex flex-col gap-4" method="POST">
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
			items={data?.typeList}
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
			label="Expected Back From Sites"
			name="returnable"
			type="checkboxSingle"
			placeholder="This item is leased out and returned, not consumed on site"
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

		<Button type="submit" class="mt-4" form="main">
			{#if $delayed}
				<LoadingBtn name="Adding Supply Item" />
			{:else}
				<Plus class="h-4 w-4" />

				Add Supply Item
			{/if}
		</Button>
	</form>
</FormCard>
