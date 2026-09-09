<script>
	import { renderComponent } from '$lib/components/ui/data-table/index.js';
	import DataTable from '$lib/components/Table/data-table.svelte';
	import DeleteEntity from '$lib/components/DeleteEntity.svelte';
	import DataTableSort from '$lib/components/Table/data-table-sort.svelte';
	import { formatDays } from '$lib/leaveDays';
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
				return renderComponent(Edit, {
					id: row.original.id,
					name: row.original.name,
					maxDays: row.original.maxDays,
					deductsBalance: row.original.deductsBalance,
					description: row.original.description,
					action: '?/edit',
					data: data?.editForm,
					icon: false,
					status: row.original.status
				});
			}
		},

		{
			accessorKey: 'maxDays',
			header: ({ column }) =>
				renderComponent(DataTableSort, {
					name: 'Maximum Days',
					onclick: column.getToggleSortingHandler()
				}),
			sortable: true,
			cell: (info) => formatDays(info.getValue())
		},

		{
			accessorKey: 'description',
			header: ({ column }) =>
				renderComponent(DataTableSort, {
					name: 'Description',
					onclick: column.getToggleSortingHandler()
				}),
			sortable: true
		},

		{
			accessorKey: 'status',
			header: 'Status',
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
				return renderComponent(Edit, {
					id: row.original.id,
					name: row.original.name,
					maxDays: row.original.maxDays,
					deductsBalance: row.original.deductsBalance,
					description: row.original.description,
					action: '?/edit',
					data: data?.editForm,
					icon: true,
					status: row.original.status
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
					entity: 'Leave Type',
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
	<title>Leave Types</title>
</svelte:head>

<DialogComp title="+ Add New Leave Type" variant="default">
	<form action="?/add" use:enhance id="main" class="flex flex-col gap-4" method="post">
		<InputComp
			{form}
			{errors}
			label="Name"
			type="text"
			name="name"
			placeholder="Enter leave type name"
			required={true}
		/>
		<InputComp
			{form}
			{errors}
			label="Maximum Days Allowed"
			type="number"
			name="maxDays"
			placeholder="Enter maximum number of days"
			required={true}
		/>
		<InputComp
			label="Drawn From Accrued Balance"
			name="deductsBalance"
			type="select"
			{form}
			{errors}
			items={[
				{ value: false, name: 'No — granted on top of the balance' },
				{ value: true, name: 'Yes — spends accrued annual leave days' }
			]}
		/>
		<InputComp
			{form}
			{errors}
			label="Description"
			type="textarea"
			name="description"
			placeholder="Enter leave type description"
			rows={5}
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
				<LoadingBtn name="Adding Leave Type" />
			{:else}
				<Plus /> Add Leave Type
			{/if}
		</Button>
	</form>
</DialogComp>
{#key data.allData}
	<DataTable {columns} data={data?.allData} search={true} fileName="Leave Types" />
{/key}
