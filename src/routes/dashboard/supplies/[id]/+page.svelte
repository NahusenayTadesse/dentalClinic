<script lang="ts">
	import { edit as schema } from './schema';
	import { createForm } from '@nahu/admin-kit/forms/createForm.js';
	import SupplyFields from '../SupplyFields.svelte';
	import { columns, lotColumns, recipientColumns } from './columns';
	import Section from '@nahu/admin-kit/components/Section.svelte';
	let { data } = $props();

	import SingleTable from '@nahu/admin-kit/components/SingleTable.svelte';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';

	import LoadingBtn from '@nahu/admin-kit/formComponents/LoadingBtn.svelte';
	import { ArrowLeft, Pencil, Save, History, Boxes, Users } from '@lucide/svelte';
	import type { Snapshot } from '@sveltejs/kit';

	import SingleView from '@nahu/admin-kit/components/SingleView.svelte';
	import DeleteEntity from '@nahu/admin-kit/components/DeleteEntity.svelte';
	import { formatEthiopianDate } from '$lib/global.svelte.js';

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
		{
			name: 'Expires',
			value: data.supply?.tracksExpiry ? 'Yes' : 'No'
		},
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

	const { form, errors, enhance, delayed, capture, restore } = createForm(data.form, schema, {
		resetForm: false
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
	$form.tracksExpiry = Boolean(data.supply?.tracksExpiry);

	export const snapshot: Snapshot = { capture, restore };

	//   let date = $derived(dateProxy(editForm, 'appointmentDate', { format: 'date'}));
	import Adjustment from '$lib/forms/Adjustment.svelte';
	import { getCurrentMonthRange } from '$lib/global.svelte.js';
	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
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
			suppliers={data.supplierList}
			tracksExpiry={data.supply?.tracksExpiry ?? false}
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
				<SupplyFields {form} {errors} typeList={data.typeList} />

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

<div class="w-full py-4">
	<Section title="Stock by lot" IconComp={Boxes} style="identityIcon">
		{#if data.lots.length}
			<DataTable
				data={data.lots}
				columns={lotColumns}
				search={false}
				fileName="{data.supply?.name} lots"
				height="auto"
			/>
		{:else}
			<p class="text-sm text-muted-foreground">
				Nothing in store. Receive a delivery to add a lot.
			</p>
		{/if}
	</Section>
</div>

{#if data.recipients}
	<!-- The lot trace: a supplier's recall names a lot number; search for it here. -->
	<div class="w-full py-4">
		<Section title="Who received it, by lot" IconComp={Users} style="identityIcon">
			{#if data.recipients.length}
				<DataTable
					data={data.recipients}
					columns={recipientColumns}
					facetKeys={['batchNumber']}
					fileName="{data.supply?.name} recipients"
					height="auto"
				/>
			{:else}
				<p class="text-sm text-muted-foreground">
					None of this item has been recorded as used for a patient. Name the patient when taking
					stock out, and a recall of a lot can be traced to who had it.
				</p>
			{/if}
		</Section>
	</div>
{/if}

<DataTable data={data?.suppliers} {columns} fileName="{data?.supply?.name} Suppliers List" />
