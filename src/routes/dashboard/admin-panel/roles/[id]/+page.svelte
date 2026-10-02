<script lang="ts">
	import { zod4Client } from 'sveltekit-superforms/adapters';
	import { editRoleSchema } from './schema';

	let { data } = $props();

	import SingleTable from '$lib/components/SingleTable.svelte';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import { superForm } from 'sveltekit-superforms/client';

	import LoadingBtn from '@nahu/admin-kit/formComponents/LoadingBtn.svelte';
	import { ArrowLeft, Pencil, Save, Trash } from '@lucide/svelte';
	import type { Snapshot } from '@sveltejs/kit';

	import DeleteEntity from '$lib/components/DeleteEntity.svelte';
	import SingleView from '$lib/components/SingleView.svelte';
	import DataTable from '$lib/components/Table/data-table.svelte';
	import { columns, userColumns } from './columns.js';
	import InputComp from '$lib/formComponents/InputComp.svelte';
	import Errors from '$lib/formComponents/Errors.svelte';

	let singleTable = $derived([
		{ name: 'Name', value: data.singleUser?.name },

		{
			name: 'Description',
			value: data.singleUser?.description
		},
		{
			name: 'User Count',
			value: data?.singleUser?.userCount || 0
		},
		{ name: 'Permission Count', value: data?.permissionList?.length || 0 }
	]);

	const { form, errors, enhance, delayed, capture, restore, allErrors, message } = superForm(
		data.form,
		{
			validators: zod4Client(editRoleSchema),
			dataType: 'json',
			resetForm: false
		}
	);

	import { toast } from 'svelte-sonner';
	import DialogComp from '$lib/formComponents/DialogComp.svelte';

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

	let edit = $state(false);

	$form.name = data.singleUser?.name;
	$form.description = data.singleUser?.description || '';
	$form.permissions = data.permissionList.map((item) => String(item.id)) || [];
</script>

<svelte:head>
	<title>Role Details</title>
</svelte:head>
<SingleView title="Role Details">
	<div class="mt-4 flex w-full flex-row items-start justify-start gap-2 pl-4">
		<Button onclick={() => (edit = !edit)}>
			{#if !edit}
				<Pencil class="h-4 w-4" />
				Edit
			{:else}
				<ArrowLeft class="h-4 w-4" />

				Back
			{/if}
		</Button>
		{#if data.singleUser?.userCount > 0}
			<Button
				variant="destructive"
				onclick={() => toast.error('Cannot delete role with users')}
				title="Cannot delete role with users"><Trash /> Delete</Button
			>
		{:else}
			<DeleteEntity
				entity="Role"
				name={data.singleUser?.name}
				consequence="Its permission grants are removed with it."
				canDelete={data?.isSuperAdmin}
			/>
		{/if}
	</div>
	{#if edit === false}
		<div class="w-full p-4"><SingleTable {singleTable} /></div>
	{/if}
	{#if edit}
		<div class="w-full p-4">
			<form use:enhance action="?/edit" id="main" class="flex flex-col gap-4" method="POST">
				<Errors allErrors={$allErrors} />
				<InputComp
					label="Name"
					name="name"
					type="text"
					{form}
					{errors}
					placeholder="Enter Role Name"
				/>
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
						<LoadingBtn name="Saving Change" />
					{:else}
						<Save class="h-4 w-4" />

						Save Changes
					{/if}
				</Button>
			</form>
		</div>
	{/if}
</SingleView>

<br />

{#if data?.userList?.length}
	<h3>Users on this Role</h3>
	<DataTable
		data={data?.userList}
		columns={userColumns}
		fileName="{data?.singleUser.name} Users List"
	/>
{/if}
{#if data?.permissionList?.length}
	<h3>Permissions on this Role</h3>

	<DataTable
		data={data?.permissionList}
		{columns}
		fileName="{data?.singleUser.name} Permissions List"
	/>
{/if}
