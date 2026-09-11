<script lang="ts">
	import { zod4Client } from 'sveltekit-superforms/adapters';
	import { edit as schema } from './schema';
	import InputComp from '$lib/formComponents/InputComp.svelte';
	import { columns } from './columns';
	let { data } = $props();

	import SingleTable from '$lib/components/SingleTable.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { superForm } from 'sveltekit-superforms/client';

	import LoadingBtn from '$lib/formComponents/LoadingBtn.svelte';
	import { ArrowLeft, Pencil, Save, History } from '@lucide/svelte';
	import type { Snapshot } from '@sveltejs/kit';

	import SingleView from '$lib/components/SingleView.svelte';
	import DeleteEntity from '$lib/components/DeleteEntity.svelte';
	import { formatEthiopianDate } from '$lib/global.svelte.js';
	import { fly } from 'svelte/transition';

	/**
	 * The company owns this stock wherever it sits, so all four figures are
	 * shown. Stock on hand is the sum of the item's open lots — see `server/stock.ts`. The
	 * reserved and out-at-sites figures beside it came from lease rows, which went with the
	 * facilities prune.
	 */
	let singleTable = $derived([
		{ name: 'Name', value: data.supply?.name },
		{ name: 'In Store', value: data.supply?.quantity },
		{ name: 'Kind', value: data.supply?.returnable ? 'Returnable' : 'Consumable' },
		{ name: 'Unit of Measurement', value: data.supply?.unitOfMeasure },
		{ name: 'Product Description', value: data.supply?.description },
		{ name: 'Reorder Notification Quantity', value: data.supply?.reorderLevel },
		{ name: 'Added On', value: formatEthiopianDate(new Date(data?.supply?.createdAt)) },
		{
			name: 'Added By',
			value: data.supply?.createdBy,
			// Null id means the account was deleted — name without a dead link.
			href: data.supply?.createdById ? `${USER_PAGE}/${data.supply.createdById}` : null
		}
	]);

	const { form, errors, enhance, delayed, capture, restore, message } = superForm(data.form, {
		validators: zod4Client(schema),
		resetForm: false
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

	// `description`, `unit_of_measure` and `reorder_level` are all nullable in the
	// database, so each null is mapped to whatever the form's own type expects
	// rather than assigned straight through.
	$form.name = data.supply?.name ?? '';
	$form.description = data.supply?.description ?? undefined;
	$form.supplyType = data.supply?.supplyTypeId != null ? String(data.supply.supplyTypeId) : '';
	$form.unitOfMeasurement = data.supply?.unitOfMeasure ?? '';
	// A null reorder level means "no low-stock alert". The field is left at its
	// own default in that case: the schema requires a positive number, so
	// seeding it with 0 would show a value that fails on save.
	if (data.supply?.reorderLevel != null) {
		$form.reorderLevel = data.supply.reorderLevel;
	}
	$form.returnable = Boolean(data.supply?.returnable);

	export const snapshot: Snapshot = { capture, restore };

	//   let date = $derived(dateProxy(editForm, 'appointmentDate', { format: 'date'}));
	import Adjustment from '$lib/forms/Adjustment.svelte';
	import { getCurrentMonthRange } from '$lib/global.svelte.js';
	import DataTable from '$lib/components/Table/data-table.svelte';
	import Damaged from '$lib/forms/Damaged.svelte';
	import { USER_PAGE } from '$lib/tableCells';

	let edit = $state(false);
</script>

<svelte:head>
	<title>Supply Details</title>
</svelte:head>

<SingleView title="Supply Details">
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
			entity="Supply"
			name={data?.supply?.name}
			consequence="Its adjustment history and damage reports go with it."
			canDelete={data?.isSuperAdmin}
		/>
		<Adjustment
			data={data.adjustForm}
			name={data.supply?.name}
			employees={data.employeesList}
			paymentMethods={data.paymentMethods}
		/>
		<Damaged data={data.damagedForm} name={data.supply?.name} employees={data.employeesList} />
		<Button href="/dashboard/supplies/{data.supply.id}/ranges/{getCurrentMonthRange()}">
			<History /> See Change History
		</Button>
	</div>
	{#if edit === false}
		<div class="w-full p-4"><SingleTable {singleTable} /></div>
	{/if}
	{#if edit}
		<div class="w-full p-4">
			<form action="?/editSupply" use:enhance class="flex flex-col gap-4" id="edit" method="post">
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
					label="Expected Back"
					name="returnable"
					type="checkboxSingle"
					placeholder="Chased for return once issued — instruments and equipment, not consumables"
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

<DataTable data={data?.suppliers} {columns} fileName="{data?.supply?.name} Suppliers List" />
