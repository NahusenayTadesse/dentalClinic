<script lang="ts">
	import { renderComponent } from '$lib/components/ui/data-table/index.js';
	import DataTable from '$lib/components/Table/data-table.svelte';
	import DeleteEntity from '$lib/components/DeleteEntity.svelte';
	import DataTableSort from '$lib/components/Table/data-table-sort.svelte';
	import DialogComp from '$lib/formComponents/DialogComp.svelte';
	import InputComp from '$lib/formComponents/InputComp.svelte';
	import LoadingBtn from '$lib/formComponents/LoadingBtn.svelte';
	import { Button } from '$lib/components/ui/button/index';
	import { superForm } from 'sveltekit-superforms/client';
	import { toast } from 'svelte-sonner';
	import { Plus } from '@lucide/svelte';
	import Edit from './edit.svelte';

	let { data } = $props();

	const { form, errors, enhance, delayed } = superForm(data.form, {
		id: 'add',
		onUpdated({ form: result }) {
			if (result.message) {
				if (result.message.type === 'error') toast.error(result.message.text);
				else toast.success(result.message.text);
			}
		}
	});

	const columns = [
		{
			id: 'index',
			header: '#',
			cell: (info) => info.row.index + 1,
			enableSorting: false
		},
		{
			accessorKey: 'name',
			header: ({ column }) =>
				renderComponent(DataTableSort, {
					name: 'Name',
					onclick: column.getToggleSortingHandler()
				}),
			cell: ({ row }) =>
				renderComponent(Edit, {
					id: row.original.id,
					name: row.original.name,
					description: row.original.description,
					action: '?/edit',
					data: data?.editForm,
					icon: false
				})
		},
		{
			accessorKey: 'description',
			header: 'Description',
			cell: (info) => info.getValue() ?? '—'
		},
		{
			accessorKey: 'supplyCount',
			header: ({ column }) =>
				renderComponent(DataTableSort, {
					name: 'Items',
					onclick: column.getToggleSortingHandler()
				}),
			// A type with no items behind it is the only kind that can be deleted.
			cell: (info) => (Number(info.getValue()) === 0 ? 'None' : `${info.getValue()} item(s)`)
		},
		{
			accessorKey: 'totalStock',
			header: ({ column }) =>
				renderComponent(DataTableSort, {
					name: 'Units In Store',
					onclick: column.getToggleSortingHandler()
				})
		},
		{
			accessorKey: '',
			header: 'Edit',
			enableSorting: false,
			cell: ({ row }) =>
				renderComponent(Edit, {
					id: row.original.id,
					name: row.original.name,
					description: row.original.description,
					action: '?/edit',
					data: data?.editForm,
					icon: true
				})
		},
		{
			id: 'delete',
			header: '',
			enableSorting: false,
			// Renders nothing unless the viewer is a super admin; the action
			// re-checks, and refuses any type that still has supplies under it.
			cell: ({ row }) =>
				renderComponent(DeleteEntity, {
					entity: 'Supply Type',
					name: row.original?.name,
					id: row.original?.id,
					consequence:
						Number(row.original?.supplyCount) > 0
							? `${row.original.supplyCount} supply item(s) still use this type — the delete will be refused until they are moved.`
							: 'Nothing uses this type.',
					icon: true,
					canDelete: data?.isSuperAdmin
				})
		}
	];
</script>

<svelte:head>
	<title>Supply Types</title>
</svelte:head>

{#key data.allData}
	<DialogComp title="+ Add New Supply Type" variant="default">
		<form action="?/add" use:enhance id="main" class="flex flex-col gap-4" method="post">
			<InputComp
				{form}
				{errors}
				label="Name"
				type="text"
				name="name"
				required={true}
				placeholder="e.g. Machinery"
			/>

			<InputComp
				{form}
				{errors}
				label="Description"
				type="textarea"
				name="description"
				rows={4}
				placeholder="What belongs in this category"
			/>

			<Button type="submit" form="main">
				{#if $delayed}
					<LoadingBtn name="Adding Supply Type" />
				{:else}
					<Plus /> Add Supply Type
				{/if}
			</Button>
		</form>
	</DialogComp>

	<DataTable {columns} data={data?.allData} search={true} fileName="Supply Types" />
{/key}
