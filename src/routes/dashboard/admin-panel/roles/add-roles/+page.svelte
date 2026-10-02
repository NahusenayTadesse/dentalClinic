<script lang="ts">
	import type { Snapshot } from '@sveltejs/kit';
	import { Plus } from '@lucide/svelte';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import { createRoleSchema } from './schema';
	import { createForm } from '@nahu/admin-kit/forms/createForm.js';
	import LoadingBtn from '@nahu/admin-kit/formComponents/LoadingBtn.svelte';
	import Errors from '@nahu/admin-kit/formComponents/Errors.svelte';

	let { data } = $props();

	// svelte-ignore state_referenced_locally
	const { form, errors, enhance, delayed, capture, restore, allErrors } = createForm(
		data.form,
		createRoleSchema,
		{
			dataType: 'json'
		}
	);

	import FormCard from '@nahu/admin-kit/formComponents/FormCard.svelte';
	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';

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
