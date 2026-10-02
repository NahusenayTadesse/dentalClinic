<script lang="ts">
	import type { Snapshot } from '@sveltejs/kit';
	import { Plus } from '@lucide/svelte';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import { zod4Client } from 'sveltekit-superforms/adapters';
	import { createRoleSchema } from './schema';
	import { superForm } from 'sveltekit-superforms/client';
	import LoadingBtn from '@nahu/admin-kit/formComponents/LoadingBtn.svelte';
	import Errors from '@nahu/admin-kit/formComponents/Errors.svelte';

	let { data } = $props();

	const { form, errors, enhance, delayed, capture, restore, message, allErrors } = superForm(
		data.form,
		{
			dataType: 'json',
			onUpdated({ form }) {
				if (form.message) {
					if (form.message.type === 'success') {
						toast.success(form.message.text);
					} else {
						toast.error(form.message.text);
					}
				}
			},

			validators: zod4Client(createRoleSchema)
		}
	);

	import { toast } from 'svelte-sonner';
	import FormCard from '@nahu/admin-kit/formComponents/FormCard.svelte';
	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';
	// $effect(() => {
	// 	if ($message) {
	// 		if ($message.type === 'error') {
	// 			toast.error($message.text);
	// 		} else {
	// 			toast.success($message.text);
	// 		}
	// 	}
	// });

	export const snapshot: Snapshot = { capture, restore };
	// 	 function getItemNameById(items: any, value: any) {
	//   const item = items.find(i=> i.value === value);
	//   return item ? item.name : null; // returns null if not found
	// }
	//
</script>

<svelte:head>
	<title>Add New Role</title>
</svelte:head>

<FormCard title="Add New Role">
	<form use:enhance action="?/add" id="main" class="flex flex-col gap-4" method="POST">
		<Errors allErrors={$allErrors} />
		<InputComp label="Name" name="name" type="text" {form} {errors} placeholder="Enter Role Name" />
		<InputComp
			label="Description"
			name="description"
			type="textarea"
			{form}
			{errors}
			placeholder="Enter Role Description"
		/>
		<InputComp
			label="Permissions"
			name="permissions"
			type="checkbox"
			{form}
			{errors}
			placeholder="Enter Role Name"
			items={data?.allPermissions}
		/>

		<Button type="submit" class="mt-4" form="main">
			{#if $delayed}
				<LoadingBtn name="Adding Role" />
			{:else}
				<Plus class="h-4 w-4" />

				Add Role
			{/if}
		</Button>
	</form>
</FormCard>
