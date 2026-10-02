<script lang="ts">
	import { createForm, confirmLeave } from '@nahu/admin-kit/forms/createForm.js';
	import type { Snapshot } from '@sveltejs/kit';

	import LoadingBtn from '@nahu/admin-kit/formComponents/LoadingBtn.svelte';

	import { Plus } from '@lucide/svelte';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import { supplyItemSchema } from './schema';
	import FormCard from '@nahu/admin-kit/formComponents/FormCard.svelte';
	import SupplyFields from '../SupplyFields.svelte';

	let { data } = $props();

	const { form, errors, enhance, delayed, capture, restore } = createForm(
		data.form,
		supplyItemSchema,
		{
			taintedMessage: confirmLeave
		}
	);

	export const snapshot: Snapshot = { capture, restore };
</script>

<svelte:head>
	<title>Add New Supply Item</title>
</svelte:head>

<FormCard title="Add Supplies">
	<form use:enhance action="?/add" id="main" class="flex flex-col gap-4" method="POST">
		<SupplyFields {form} {errors} typeList={data.typeList} />

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
