<script>
	import { renderComponent } from '$lib/components/ui/data-table/index.js';
	import DataTable from '$lib/components/Table/data-table.svelte';
	import DeleteEntity from '$lib/components/DeleteEntity.svelte';
	import DataTableSort from '$lib/components/Table/data-table-sort.svelte';
	import Statuses from '$lib/components/Table/statuses.svelte';
	import DialogComp from '$lib/formComponents/DialogComp.svelte';
	import { Button } from '$lib/components/ui/button/index';
	import Edit from './edit.svelte';
	export const columns = [
		{
			id: 'index',
			header: '#',
			cell: (info) => {
				const rowIndex = info.table.getRowModel().rows.findIndex((row) => row.id === info.row.id);
				return rowIndex + 1;
			},
			enableSorting: false
		},
		{
			accessorKey: 'name',
			header: ({ column }) =>
				renderComponent(DataTableSort, {
					name: 'Name',
					onclick: column.getToggleSortingHandler()
				}),
			sortable: true,
			cell: ({ row }) => {
				// You can pass whatever you need from `row.original` to the component
				return renderComponent(Edit, {
					id: row.original.id,
					name: row.original.name,
					categoryId: row.original.categoryId,
					description: row.original.description,
					action: '?/edit',
					data: data?.editForm,
					icon: false,
					status: row.original.status,
					items: data?.categoryList
				});
			}
		},
		{
			accessorKey: 'category',
			header: ({ column }) =>
				renderComponent(DataTableSort, {
					name: 'Category',
					onclick: column.getToggleSortingHandler()
				}),
			sortable: true
		},
		{
			accessorKey: 'description',
			header: 'Description',
			sortable: true
		},

		{
			accessorKey: 'status',
			header: ({ column }) =>
				renderComponent(DataTableSort, {
					name: 'Status',
					onclick: column.getToggleSortingHandler()
				}),
			sortable: true,
			cell: ({ row }) => {
				return renderComponent(Statuses, {
					status: row.original.status ? 'Active' : 'Inactive'
				});
			}
		},

		{
			accessorKey: '',
			header: 'Edit',
			sortable: true,
			cell: ({ row }) => {
				// You can pass whatever you need from `row.original` to the component
				return renderComponent(Edit, {
					id: row.original.id,
					name: row.original.name,
					categoryId: row.original.categoryId,
					description: row.original.description,
					action: '?/edit',
					data: data?.editForm,
					icon: true,
					status: row.original.status,
					items: data?.categoryList
				});
			}
		},

		{
			id: 'delete',
			header: '',
			enableSorting: false,
			// Renders nothing unless the viewer is a super admin; the action re-checks.
			cell: ({ row }) =>
				renderComponent(DeleteEntity, {
					entity: 'Service',
					name: row.original?.name,
					id: row.original?.id,
					icon: true,
					canDelete: data?.isSuperAdmin
				})
		}
	];
	let { data } = $props();
	import { superForm } from 'sveltekit-superforms/client';
	import InputComp from '$lib/formComponents/InputComp.svelte';
	import LoadingBtn from '$lib/formComponents/LoadingBtn.svelte';
	import { Plus } from '@lucide/svelte';

	const { form, errors, enhance, delayed, message } = superForm(data.form, {});

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
</script>

<svelte:head>
	<title>Services</title>
</svelte:head>

<DialogComp title="+ Add New Services" variant="default">
	<form action="?/add" use:enhance id="main" class="flex flex-col gap-4" method="post">
		<InputComp {form} {errors} label="name" type="text" name="name" required={true} />
		<InputComp
			{form}
			{errors}
			label="category"
			type="select"
			name="category"
			items={data?.categoryList}
			required={true}
		/>

		<InputComp
			{form}
			{errors}
			label="Description"
			type="textarea"
			name="description"
			placeholder="Enter Service Description"
			required={true}
			rows={10}
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

		<Button type="submit" form="main">
			{#if $delayed}
				<LoadingBtn name="Adding Service" />
			{:else}
				<Plus /> Add Service
			{/if}
		</Button>
	</form>
</DialogComp>
{#key data.allData}
	<DataTable {columns} data={data?.allData} search={true} fileName="Service Categories" />
{/key}
