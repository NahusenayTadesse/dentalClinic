<script lang="ts">
	import { Input } from '@nahu/admin-kit/components/ui/input/index.js';
	import { Label } from '@nahu/admin-kit/components/ui/label/index.js';
	import { zod4Client } from 'sveltekit-superforms/adapters';
	import { editUserSchema } from './schema';

	let { data } = $props();

	import SingleTable from '$lib/components/SingleTable.svelte';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import { superForm } from 'sveltekit-superforms/client';

	import LoadingBtn from '@nahu/admin-kit/formComponents/LoadingBtn.svelte';
	import { ArrowLeft, Eye, Pencil, Save } from '@lucide/svelte';
	import SelectComp from '$lib/formComponents/SelectComp.svelte';
	import type { Snapshot } from '@sveltejs/kit';

	import DeleteEntity from '$lib/components/DeleteEntity.svelte';
	import SingleView from '$lib/components/SingleView.svelte';
	import Errors from '$lib/formComponents/Errors.svelte';
	import DataTable from '$lib/components/Table/data-table.svelte';
	import { columns } from './columns.js';

	let singleTable = $derived([
		{ name: 'Name', value: data.singleUser?.name },
		{ name: 'Email', value: data.singleUser?.email },
		{ name: 'Role', value: data.singleUser?.role },
		{ name: 'Status', value: data.singleUser?.status ? 'Active' : 'Inactive' },
		{ name: 'Created At', value: data.singleUser?.createdAt.toLocaleString() },
		{ name: 'Updated At', value: data.singleUser?.updatedAt.toLocaleString() }
	]);

	const { form, errors, enhance, delayed, capture, restore, allErrors, message } = superForm(
		data.form,
		{
			validators: zod4Client(editUserSchema),
			resetForm: false,
			dataType: 'json'
		}
	);

	import { toast } from 'svelte-sonner';
	import InputComp from '$lib/formComponents/InputComp.svelte';
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

	//   let date = $derived(dateProxy(editForm, 'appointmentDate', { format: 'date'}));

	let edit = $state(false);

	$form.name = data.singleUser?.name;
	$form.email = data.singleUser?.email;
	$form.role = data.singleUser?.roleId;
	$form.status = data.singleUser?.status;
	$form.permissionsList = data?.permissionList.map((item) => item.value) || [];
</script>

<svelte:head>
	<title>User Details</title>
</svelte:head>
<SingleView title="User Details">
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
		{#if data?.singleUser?.employeeId}
			<Button href="/dashboard/employees/single/{data?.singleUser?.employeeId}">
				<Eye /> View User's Employee's Details
			</Button>
		{/if}
		<DeleteEntity
			entity="User"
			name={data?.singleUser?.name}
			consequence="They are signed out everywhere and their extra permissions are revoked. Records they created stay, still showing their name."
			canDelete={data?.isSuperAdmin && data?.singleUser?.id !== data?.user?.id}
		/>
	</div>
	{#if edit === false}
		<div class="w-full p-4"><SingleTable {singleTable} /></div>
	{/if}
	{#if edit}
		<div class="w-full p-4">
			<form action="?/editUser" use:enhance class="flex flex-col gap-4" id="edit" method="post">
				<h3 class="text-center text-red-500">
					Any changes made here will signout the user from every device they are logged in on.
				</h3>

				<Errors allErrors={$allErrors} />

				{@render fe('Name', 'name', 'text', 'Change Name', true)}
				{@render fe('Email', 'email', 'email', 'Change email', true)}

				{@render selects('role', data?.roleList)}
				{@render selects('status', [
					{ value: true, name: 'Active' },
					{ value: false, name: 'Inactive' }
				])}

				<InputComp
					{form}
					{errors}
					name="editPermission"
					type="checkboxSingle"
					label="Edit Permission"
					placeholder="Edit and Modify User Permissions"
				/>
				{#if $form.editPermission}
					<InputComp
						label="Permissions"
						name="permissionsList"
						type="checkbox"
						{form}
						{errors}
						placeholder="Enter Role Name"
						items={data?.allPerms}
					/>
				{/if}

				<Button form="edit" type="submit" class="mt-4">
					{#if $delayed}
						<LoadingBtn name="Saving Changes" />
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

<DataTable
	data={data?.permissionList}
	{columns}
	fileName="{data?.singleUser?.name}Permission List"
/>

{#snippet fe(
	label = '',
	name = '',
	type = '',
	placeholder = '',
	required = false,
	min = '',
	max = ''
)}
	<div class="flex w-full flex-col justify-start gap-2">
		<Label for={name}>{label}</Label>
		<Input
			{type}
			{name}
			{placeholder}
			{required}
			{min}
			{max}
			bind:value={$form[name]}
			aria-invalid={$errors[name] ? 'true' : undefined}
		/>
		{#if $errors[name]}
			<span class="text-red-500">{$errors[name]}</span>
		{/if}
	</div>
{/snippet}
{#snippet selects(name, items)}
	<div class="flex w-full flex-col justify-start gap-2">
		<Label for={name} class="capitalize">{name.replace(/([a-z])([A-Z])/g, '$1 $2')}:</Label>

		<SelectComp {name} bind:value={$form[name]} {items} />
		{#if $errors[name]}<span class="text-red-500">{$errors[name]}</span>{/if}
	</div>
{/snippet}
