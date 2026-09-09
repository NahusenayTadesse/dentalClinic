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
					phone: row.original.phone,
					location: row.original.location,
					description: row.original.description,
					action: '?/edit',
					data: data?.editForm,
					icon: false,
					status: row.original.status
				});
			}
		},

		{
			accessorKey: 'commission',
			header: ({ column }) =>
				renderComponent(DataTableSort, {
					name: 'Commission',
					onclick: column.getToggleSortingHandler()
				}),
			sortable: true,
			cell: ({ row }) => {
				return renderComponent(Statuses, {
					status: row.original.commission ? 'Calculated' : 'Not Calculated'
				});
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
					phone: row.original.phone,
					location: row.original.location,
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
					entity: 'Department',
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

	const { form, errors, enhance, delayed, message } = superForm(data.form, {
		onUpdated({ form }) {
			if (form.message) {
				if (form.message) {
					if (form.message.type === 'error') {
						toast.error(form.message.text);
					} else {
						toast.success(form.message.text);
					}
				}
			}
		}
	});

	import { toast } from 'svelte-sonner';
	// $effect(() => {
	// 	if ($message) {
	// 		if ($message.type === 'error') {
	// 			toast.error($message.text);
	// 		} else {
	// 			toast.success($message.text);
	// 		}
	// 	}
	// });
</script>

<svelte:head>
	<title>Departments</title>
</svelte:head>
{#key data.allData}
	<DialogComp title="+ Add New Department" variant="default">
		<form action="?/add" use:enhance id="main" class="flex flex-col gap-4" method="post">
			<InputComp {form} {errors} label="name" type="text" name="name" required={true} />

			<InputComp
				{form}
				{errors}
				label="Calculate Commission for this department's employees"
				type="select"
				name="commission"
				placeholder="Enter Department Commission"
				items={[
					{ value: true, name: 'Calculate Commission for this department' },
					{ value: false, name: 'Do Not Calculate Commission for this department' }
				]}
			/>
			<InputComp
				{form}
				{errors}
				label="Description"
				type="textarea"
				name="description"
				placeholder="Enter Department Description"
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
					<LoadingBtn name="Adding Department" />
				{:else}
					<Plus /> Add Department
				{/if}
			</Button>
		</form>
	</DialogComp>

	<DataTable {columns} data={data?.allData} search={true} fileName="Departments" />
{/key}
