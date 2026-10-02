<script>
	import { renderComponent } from '@nahu/admin-kit/components/ui/data-table/index.js';
	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import DeleteEntity from '@nahu/admin-kit/components/DeleteEntity.svelte';
	import DataTableSort from '@nahu/admin-kit/components/Table/data-table-sort.svelte';
	import Statuses from '@nahu/admin-kit/components/Table/statuses.svelte';
	import DialogComp from '@nahu/admin-kit/formComponents/DialogComp.svelte';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import Edit from './edit.svelte';

	const editProps = (row, icon) => ({
		id: row.id,
		name: row.name,
		expiryYears: row.expiryYears,
		description: row.description,
		action: '?/edit',
		data: data?.editForm,
		icon,
		status: row.status
	});

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
					name: 'Policy',
					onclick: column.getToggleSortingHandler()
				}),
			cell: ({ row }) => renderComponent(Edit, editProps(row.original, false))
		},

		{
			accessorKey: 'expiryYears',
			header: ({ column }) =>
				renderComponent(DataTableSort, {
					name: 'Expires After',
					onclick: column.getToggleSortingHandler()
				}),
			cell: (info) => `${info.getValue()} year${info.getValue() === 1 ? '' : 's'}`
		},

		{
			accessorKey: 'description',
			header: ({ column }) =>
				renderComponent(DataTableSort, {
					name: 'Description',
					onclick: column.getToggleSortingHandler()
				})
		},

		{
			accessorKey: 'status',
			header: 'In Effect',
			cell: ({ row }) => {
				return renderComponent(Statuses, {
					status: row.original.status ? 'Active' : 'Inactive'
				});
			}
		},

		{
			accessorKey: '',
			header: 'Edit',
			cell: ({ row }) => renderComponent(Edit, editProps(row.original, true))
		},

		{
			id: 'delete',
			header: '',
			enableSorting: false,
			// Renders nothing unless the viewer is a super admin; the action re-checks.
			cell: ({ row }) =>
				renderComponent(DeleteEntity, {
					entity: 'Expiry Policy',
					name: row.original?.name,
					id: row.original?.id,
					icon: true,
					canDelete: data?.isSuperAdmin
				})
		}
	];

	let { data } = $props();
	import { superForm } from 'sveltekit-superforms/client';
	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';
	import LoadingBtn from '@nahu/admin-kit/formComponents/LoadingBtn.svelte';
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
	<title>Leave Expiry Policy</title>
</svelte:head>

<div class="mb-4 max-w-3xl text-sm text-muted-foreground">
	How long unused annual leave stays usable. Each yearly grant is voided once this many years have
	passed since it was granted, and the employee keeps only the days accrued in the years still
	within the window. Only one policy is in effect at a time — activating a policy retires the
	others.
</div>

<DialogComp title="+ Add New Expiry Policy" variant="default">
	<form action="?/add" use:enhance id="main" class="flex flex-col gap-4" method="post">
		<InputComp
			{form}
			{errors}
			label="Policy Name"
			type="text"
			name="name"
			placeholder="Enter policy name"
			required={true}
		/>
		<InputComp
			{form}
			{errors}
			label="Unused Leave Expires After (Years)"
			type="number"
			name="expiryYears"
			placeholder="e.g. 2"
			required={true}
		/>
		<InputComp
			{form}
			{errors}
			label="Description"
			type="textarea"
			name="description"
			placeholder="Enter a note about this policy"
			rows={4}
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
				<LoadingBtn name="Adding Expiry Policy" />
			{:else}
				<Plus /> Add Expiry Policy
			{/if}
		</Button>
	</form>
</DialogComp>
{#key data.allData}
	<DataTable {columns} data={data?.allData} search={true} fileName="Leave Expiry Policy" />
{/key}
