<script lang="ts">
	import SingleTable from '@nahu/admin-kit/components/SingleTable.svelte';
	import SingleView from '@nahu/admin-kit/components/SingleView.svelte';
	import DeleteEntity from '@nahu/admin-kit/components/DeleteEntity.svelte';
	import FormDialog from '@nahu/admin-kit/formComponents/FormDialog.svelte';
	import { supplier } from '$lib/forms/supplier';
	import SupplierFields from '../SupplierFields.svelte';

	/** One supplier: its details, changed in a dialog, and soft delete for a super admin. */
	let { data } = $props();

	const singleTable = $derived([
		{ name: 'Name', value: data.single.name },
		{ name: 'Phone', value: data.single.phone },
		{ name: 'Email', value: data.single.email },
		{ name: 'Description', value: data.single.description },
		{ name: 'Subcity', value: data.single.subcity },
		{ name: 'Street', value: data.single.street },
		{ name: 'Kebele', value: data.single.kebele },
		{ name: 'Building', value: data.single.buildingNumber },
		{ name: 'Floor', value: data.single.floor },
		{ name: 'House Number', value: data.single.houseNumber },
		{ name: 'Status', value: data.single.status ? 'Active' : 'Inactive' }
	]);
</script>

<svelte:head>
	<title>{data.single.name} · Supplier</title>
</svelte:head>

<SingleView title={data.single.name}>
	<div class="mt-4 flex w-full flex-row items-start justify-start gap-2 pl-4">
		<FormDialog
			title="Change this supplier"
			action="?/edit"
			data={data.editForm}
			schema={supplier}
			triggerLabel="Edit"
		>
			{#snippet fields({ form, errors })}
				<SupplierFields {form} {errors} subcities={data.subcitiesList} />
			{/snippet}
		</FormDialog>
		<DeleteEntity
			entity="Supplier"
			name={data.single.name}
			consequence="Past stock adjustments stay, but stop naming this supplier."
			canDelete={data.isSuperAdmin}
		/>
	</div>
	<div class="w-full p-4"><SingleTable {singleTable} /></div>
</SingleView>
