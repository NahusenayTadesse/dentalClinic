<script>
	import { renderComponent } from '@nahu/admin-kit/components/ui/data-table/index.js';
	import DataTable from '$lib/components/Table/data-table.svelte';
	import DeleteEntity from '@nahu/admin-kit/components/DeleteEntity.svelte';
	import DataTableSort from '@nahu/admin-kit/components/Table/data-table-sort.svelte';
	import Statuses from '@nahu/admin-kit/components/Table/statuses.svelte';
	import DialogComp from '@nahu/admin-kit/formComponents/DialogComp.svelte';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import Edit from './edit.svelte';

	const rangeLabel = (row) =>
		row.toYears === null
			? `${row.fromYears} years and above`
			: row.fromYears === row.toYears
				? `Year ${row.fromYears}`
				: `${row.fromYears} to ${row.toYears} years`;

	const editProps = (row, icon) => ({
		id: row.id,
		fromYears: row.fromYears,
		toYears: row.toYears,
		days: row.days,
		description: row.description,
		label: rangeLabel(row),
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
			accessorKey: 'fromYears',
			header: ({ column }) =>
				renderComponent(DataTableSort, {
					name: 'Years of Service',
					onclick: column.getToggleSortingHandler()
				}),
			cell: ({ row }) => renderComponent(Edit, editProps(row.original, false))
		},

		{
			accessorKey: 'days',
			header: ({ column }) =>
				renderComponent(DataTableSort, {
					name: 'Leave Days Per Year',
					onclick: column.getToggleSortingHandler()
				}),
			cell: (info) => `${info.getValue()} days`
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
			header: 'Status',
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
					entity: 'Entitlement',
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
	<title>Annual Leave Entitlements</title>
</svelte:head>

<div class="mb-4 max-w-3xl text-sm text-muted-foreground">
	How many annual leave days an employee earns each year, based on how long they have served. An
	employee is granted the matching number of days on every employment anniversary. Leave the ending
	year empty to cover that year of service and everything above it.
</div>

<DialogComp title="+ Add New Entitlement" variant="default">
	<form action="?/add" use:enhance id="main" class="flex flex-col gap-4" method="post">
		<InputComp
			{form}
			{errors}
			label="From Year of Service"
			type="number"
			name="fromYears"
			placeholder="e.g. 1"
			required={true}
		/>
		<InputComp
			{form}
			{errors}
			label="To Year of Service"
			type="number"
			name="toYears"
			placeholder="Leave empty for this year and above"
		/>
		<InputComp
			{form}
			{errors}
			label="Leave Days Granted Per Year"
			type="number"
			name="days"
			placeholder="e.g. 16"
			required={true}
		/>
		<InputComp
			{form}
			{errors}
			label="Description"
			type="textarea"
			name="description"
			placeholder="Enter a note about this bracket"
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
				<LoadingBtn name="Adding Entitlement" />
			{:else}
				<Plus /> Add Entitlement
			{/if}
		</Button>
	</form>
</DialogComp>
{#key data.allData}
	<DataTable {columns} data={data?.allData} search={true} fileName="Annual Leave Entitlements" />
{/key}
