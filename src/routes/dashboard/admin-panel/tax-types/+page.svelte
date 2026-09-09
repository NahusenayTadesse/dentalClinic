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
					rate: row.original.rate,
					threshold: row.original.threshold,
					action: '?/edit',
					deduction: row.original.deduction,
					data: data?.editForm,
					icon: false,
					status: row.original.status
				});
			}
		},

		{
			accessorKey: 'rate',
			header: ({ column }) =>
				renderComponent(DataTableSort, {
					name: 'Rate',
					onclick: column.getToggleSortingHandler()
				}),
			sortable: true,
			cell: ({ row }) => {
				const value = Number(row.original.rate);
				return value.toLocaleString();
			}
		},
		{
			accessorKey: 'threshold',
			header: ({ column }) =>
				renderComponent(DataTableSort, {
					name: 'Threshold',
					onclick: column.getToggleSortingHandler()
				}),
			sortable: true,
			cell: ({ row }) => {
				const value = Number(row.original.threshold);
				return isNaN(value) ? 'N/A' : '<=' + formatETB(value, true);
			}
		},

		{
			accessorKey: 'deduction',
			header: ({ column }) =>
				renderComponent(DataTableSort, {
					name: 'Deduction',
					onclick: column.getToggleSortingHandler()
				}),
			sortable: true,
			cell: ({ row }) => {
				const value = Number(row.original.deduction);
				return isNaN(value) ? 'N/A' : formatETB(value, true);
			}
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
				// You can pass whatever you need from `row.original` to the component
				return renderComponent(Edit, {
					id: row.original.id,
					name: row.original.name,
					rate: row.original.rate,
					threshold: row.original.threshold,
					deduction: row.original.deduction,
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
					entity: 'Tax Type',
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
	import { formatETB } from '$lib/global.svelte';
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
	<title>Tax Types</title>
</svelte:head>

<DialogComp title="+ Add New Tax Types" variant="default">
	<form action="?/add" use:enhance id="main" class="flex flex-col gap-4" method="post">
		<InputComp
			{form}
			{errors}
			label="name"
			type="text"
			name="name"
			placeholder="Enter tax type name"
			required={true}
		/>
		<InputComp
			{form}
			{errors}
			label="Rate"
			type="number"
			name="rate"
			placeholder="Enter tax type rate"
			required={true}
		/>
		<InputComp
			{form}
			{errors}
			label="Threshold"
			type="number"
			name="threshold"
			placeholder="Enter tax type threshold"
			required={true}
		/>

		<InputComp
			{form}
			{errors}
			label="Deduction"
			type="number"
			name="deduction"
			placeholder="Enter tax type deduction"
			required={true}
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
				<LoadingBtn name="Adding Tax Type" />
			{:else}
				<Plus /> Add Tax Type
			{/if}
		</Button>
	</form>
</DialogComp>
{#key data.allData}
	<DataTable {columns} data={data?.allData} search={true} fileName="Tax Types" />
{/key}
