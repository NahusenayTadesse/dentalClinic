<script lang="ts">
	import { zod4Client } from 'sveltekit-superforms/adapters';
	import { edit as schema } from './schema';

	let { data } = $props();

	import SingleTable from '$lib/components/SingleTable.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { superForm } from 'sveltekit-superforms/client';

	import LoadingBtn from '$lib/formComponents/LoadingBtn.svelte';
	import { ArrowLeft, Pencil, Save, Trash } from '@lucide/svelte';
	import type { Snapshot } from '@sveltejs/kit';

	import DeleteEntity from '$lib/components/DeleteEntity.svelte';
	import SingleView from '$lib/components/SingleView.svelte';
	// import DataTable from '$lib/components/Table/data-table.svelte';
	// import { columns, userColumns } from './columns.js';
	import InputComp from '$lib/formComponents/InputComp.svelte';
	import Errors from '$lib/formComponents/Errors.svelte';

	let singleTable = $derived([
		{ name: 'Name', value: data.single?.name },
		{ name: 'Phone', value: data.single?.phone },
		{ name: 'Email', value: data.single?.email },

		{
			name: 'Description',
			value: data.single?.description
		},
		{ name: 'Subcity', value: data.single?.subcity },
		{ name: 'Street', value: data.single?.street },
		{ name: 'Kebele', value: data.single?.kebele },
		{ name: 'Building', value: data.single?.buildingNumber },
		{ name: 'Floor', value: data.single?.floor },
		{ name: 'House Number', value: data.single?.houseNumber },

		{ name: 'Status', value: data.single?.status ? 'Active' : 'Inactive' }
	]);

	const { form, errors, enhance, delayed, capture, restore, allErrors, message } = superForm(
		data.editForm,
		{
			validators: zod4Client(schema),
			resetForm: false
		}
	);

	import { toast } from 'svelte-sonner';
	import ComboboxComp from '$lib/formComponents/ComboboxComp.svelte';

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

	$form.addressId = data?.single?.addressId;
	$form.name = data?.single?.name;
	$form.phone = data?.single?.phone;
	$form.email = data?.single?.email;
	$form.buildingNumber = data?.single?.buildingNumber;
	$form.description = data?.single?.description || '';
	$form.floor = data?.single?.floor;
	$form.houseNumber = data?.single?.houseNumber;
	$form.status = data?.single?.status;
	$form.street = data?.single?.street;
	$form.subcity = data?.single?.subcityId;
	$form.kebele = data?.single?.kebele;
</script>

<svelte:head>
	<title>Supplier Details</title>
</svelte:head>
<SingleView title="Supplier Details">
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
		<DeleteEntity
			entity="Supplier"
			name={data.single?.name}
			consequence="Past stock adjustments stay, but stop naming this supplier."
			canDelete={data?.isSuperAdmin}
		/>
	</div>
	{#if edit === false}
		<div class="w-full p-4"><SingleTable {singleTable} /></div>
	{/if}
	{#if edit}
		<div class="w-full p-4">
			<form use:enhance action="?/edit" id="main" class="flex flex-col gap-4" method="POST">
				<Errors allErrors={$allErrors} />

				<InputComp {form} {errors} label="" type="hidden" name="addressId" required={true} />
				<InputComp {form} {errors} label="name" type="text" name="name" required={true} />
				<InputComp {form} {errors} label="phone" type="tel" name="phone" required={true} />
				<InputComp {form} {errors} label="email" type="email" name="email" required={false} />
				<InputComp
					{form}
					{errors}
					label="description"
					type="textarea"
					name="description"
					required={false}
				/>

				<h3>Supplier Address</h3>
				<InputComp
					{form}
					{errors}
					label="Subcity"
					type="combo"
					name="subcity"
					placeholder="Enter Subcity"
					required={true}
					items={data?.subcitiesList}
				/>

				<InputComp
					{form}
					{errors}
					label="Street"
					type="text"
					name="street"
					placeholder="Enter Street Name"
					required={true}
				/>
				<InputComp
					{form}
					{errors}
					label="Kebele"
					type="text"
					name="kebele"
					placeholder="Enter Kebele"
					required={true}
					rows={10}
				/>

				<InputComp
					{form}
					{errors}
					label="Building"
					type="text"
					name="buildingNumber"
					placeholder="Enter Building Name or Number"
					required={false}
				/>

				<InputComp
					{form}
					{errors}
					label="House Number"
					type="text"
					name="houseNumber"
					placeholder="Enter House Number"
					required={false}
				/>

				<InputComp
					{form}
					{errors}
					label="Floor"
					type="text"
					name="floor"
					placeholder="Enter Floor Number"
					required={false}
				/>

				<InputComp
					label="Status"
					name="status"
					type="select"
					{form}
					{errors}
					items={[
						{ value: true, name: 'Active' },
						{ value: false, name: 'Inactive' }
					]}
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

<!-- {#if data?.userList?.length}
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
{/if} -->
