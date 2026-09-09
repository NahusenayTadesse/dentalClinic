<script lang="ts">
	import { renderComponent } from '$lib/components/ui/data-table/index.js';
	import DataTable from '$lib/components/Table/data-table.svelte';
	import Copy from '$lib/Copy.svelte';
	import DataTableSort from '$lib/components/Table/data-table-sort.svelte';
	import Statuses from '$lib/components/Table/statuses.svelte';
	import Edit from './editContacts.svelte';
	import DataTableLinks from '$lib/components/Table/data-table-links.svelte';
	import DialogComp from '$lib/formComponents/DialogComp.svelte';
	import InputComp from '$lib/formComponents/InputComp.svelte';
	import Errors from '$lib/formComponents/Errors.svelte';
	import { superForm } from 'sveltekit-superforms/client';
	import { Button } from '$lib/components/ui/button/index.js';
	import LoadingBtn from '$lib/formComponents/LoadingBtn.svelte';

	import { Plus } from '@lucide/svelte';
	import type { Infer, SuperValidated } from 'sveltekit-superforms';
	import type { Item } from '$lib/global.svelte';
	import { formatEthiopianDate } from '$lib/global.svelte';
	import type { EditContract, AddContract } from './schema';
	const isActives = [
		{ value: true, name: 'Active' },
		{ value: false, name: 'Inactive' }
	];

	let {
		data,
		form: editForm,
		addForm,
		serviceList
	}: {
		data: any;
		form: SuperValidated<Infer<EditContract>>;
		addForm: SuperValidated<Infer<AddContract>>;
		serviceList: Item[];
	} = $props();
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
			accessorKey: 'contactType',
			header: ({ column }) =>
				renderComponent(DataTableSort, {
					name: 'Contact Type',
					onclick: column.getToggleSortingHandler()
				}),
			sortable: true,
			cell: ({ row }) => {
				// You can pass whatever you need from `row.original` to the component
				return renderComponent(Edit, {
					id: row.original?.id,
					contactType: row.original?.contactType,
					contactDetail: row.original?.contactDetail,
					status: row.original?.status,
					data: editForm,
					icon: false
				});
			}
		},

		{
			accessorKey: 'contactDetail',
			header: ({ column }) =>
				renderComponent(DataTableSort, {
					name: 'Contact Detail',
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
					status: row.original.status ? 'Active' : 'InActive',
					name: row.original.addedBy,
					link: '/dashboard/admin-panel/users',

					target: '_blank'
				});
			}
		},

		{
			accessorKey: 'addedBy',
			header: 'Added By',
			sortable: true,
			cell: ({ row }) => {
				return renderComponent(DataTableLinks, {
					id: row.original.addedById,
					name: row.original.addedBy,
					link: '/dashboard/admin-panel/users',

					target: '_blank'
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
					id: row.original?.id,
					contactType: row.original?.contactType,
					contactDetail: row.original?.contactDetail,
					status: row.original?.status,
					data: editForm,
					icon: true
				});
			}
		}
	];

	const { form, errors, enhance, delayed, message, allErrors } = superForm(addForm, {
		resetForm: false
	});
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

<DialogComp variant="default" title="Add Contact" IconComp={Plus}>
	<form
		action="?/addContact"
		use:enhance
		method="post"
		id="edit"
		class="flex w-full flex-col gap-4 p-4 pt-8"
		enctype="multipart/form-data"
	>
		<Errors allErrors={$allErrors} />
		<InputComp label="Contract Type" name="contractType" type="text" {form} {errors} required />
		<InputComp
			label="Service"
			name="service"
			type="checkbox"
			{form}
			{errors}
			required
			items={serviceList}
		/>
		<InputComp
			label="Contact Detail"
			name="contactDetail"
			type={$form?. === 'phone'
				? 'tel'
				: $form?.contactType === 'email'
					? 'email'
					: 'text'}
			{form}
			{errors}
			required
			placeholder={`Enter ${
				$form?.contractAmount
					? $form.contactType.charAt(0).toUpperCase() + $form.contactType.slice(1)
					: ''
			}`}
		/>

		<InputComp
			label="Status"
			name="status"
			type="select"
			{form}
			{errors}
			required
			items={isActives}
		/>

		<Button type="submit" class="mt-4" form="edit">
			{#if $delayed}
				<LoadingBtn name="Adding Contact" />
			{:else}
				<Plus class="h-4 w-4" />

				Add Contact
			{/if}
		</Button>
	</form>
</DialogComp>

{#key data}
	<DataTable {columns} {data} search={true} fileName="Contact" />
{/key}
