<script>
	import { renderComponent } from '@nahu/admin-kit/components/ui/data-table/index.js';
	import DataTable from '$lib/components/Table/data-table.svelte';
	import DataTableSort from '$lib/components/Table/data-table-sort.svelte';
	import Statuses from '$lib/components/Table/statuses.svelte';
	import DialogComp from '$lib/formComponents/DialogComp.svelte';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import Edit from './edit.svelte';
	const columns = [
		{
			accessorKey: 'index',
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
			cell: ({ row }) => {
				// You can pass whatever you need from `row.original` to the component
				return renderComponent(Edit, {
					id: row.original.id,
					name: row.original.name,
					description: row.original.description,
					action: '?/edit',
					data: data?.editForm,
					icon: false
				});
			}
		},

		{
			accessorKey: 'description',
			header: 'Description'
			// cell: ({ row }) => {
			// 	return renderComponent(BigText, {
			// 		text: row.original.description
			// 	});
			// }
		},

		{
			accessorKey: '',
			header: 'Edit',
			cell: ({ row }) => {
				// You can pass whatever you need from `row.original` to the component
				return renderComponent(Edit, {
					id: row.original.id,
					name: row.original.name,
					description: row.original.description,
					action: '?/edit',
					data: data?.editForm,
					icon: true
				});
			}
		}
		// {
		// 	accessorKey: '',
		// 	header: 'Delete',
		// 	sortable: true,
		// 	cell: ({ row }) => {
		// 		// You can pass whatever you need from `row.original` to the component
		// 		return renderComponent(Delete, {
		// 			id: row.original.id,
		// 			action: '?/delete',
		// 			data: data.deleteForm
		// 		});
		// 	}
		// }
	];
	let { data } = $props();
	import { superForm } from 'sveltekit-superforms/client';
	import InputComp from '$lib/formComponents/InputComp.svelte';
	import LoadingBtn from '$lib/formComponents/LoadingBtn.svelte';
	import { Plus } from '@lucide/svelte';

	const { form, errors, enhance, delayed, message } = superForm(data.form, {});

	import { toast } from 'svelte-sonner';
	// import BigText from '$lib/components/Table/bigText.svelte';
	import Delete from './delete.svelte';
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
	<title>Other Expense Types</title>
</svelte:head>

{#key data.allData}
	<DialogComp title="Add New Other Expense Type" IconComp={Plus} variant="default">
		<form action="?/add" use:enhance id="main" class="flex flex-col gap-4" method="post">
			<InputComp {form} {errors} label="name" type="text" name="name" required={true} />

			<InputComp
				{form}
				{errors}
				label="Description"
				type="textarea"
				name="description"
				placeholder="Enter Other Expense Type Description"
				required={true}
				rows={10}
			/>

			<Button type="submit" form="main">
				{#if $delayed}
					<LoadingBtn name="Adding Expense Type" />
				{:else}
					<Plus /> Add Other Expense Type
				{/if}
			</Button>
		</form>
	</DialogComp>

	<DataTable {columns} data={data?.allData} search={true} />
{/key}
