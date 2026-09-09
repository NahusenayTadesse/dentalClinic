<script lang="ts">
	import { renderComponent } from '$lib/components/ui/data-table/index.js';
	import DataTable from '$lib/components/Table/data-table.svelte';
	import Copy from '$lib/Copy.svelte';
	import DataTableSort from '$lib/components/Table/data-table-sort.svelte';
	import Statuses from '$lib/components/Table/statuses.svelte';
	import Edit from './editSites.svelte';
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
	import type { EditSites, AddSites, EditAddress } from './schema';
	const isActives = [
		{ value: true, name: 'Active' },
		{ value: false, name: 'Inactive' }
	];

	let {
		data,
		form: editForm,
		addForm,
		subcityList,
		addressForm
	}: {
		data: any;
		form: SuperValidated<Infer<EditSites>>;
		addForm: SuperValidated<Infer<AddSites>>;
		addressForm: SuperValidated<Infer<EditAddress>>;
		subcityList: Item[];
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
			accessorKey: 'name',
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
					name: row.original?.name,
					phone: row.original?.phone,
					startDate: row.original?.startDate,
					endDate: row.original?.endDate,
					status: row.original?.status,
					data: editForm,
					icon: false
				});
			}
		},

		{
			accessorKey: 'phone',
			header: ({ column }) =>
				renderComponent(DataTableSort, {
					name: 'Contact Detail',
					onclick: column.getToggleSortingHandler()
				}),
			sortable: true
		},

		{
			accessorKey: 'startDate',
			header: ({ column }) =>
				renderComponent(DataTableSort, {
					name: 'Start Date',
					onclick: column.getToggleSortingHandler()
				}),
			sortable: true,
			cell: (info) => formatEthiopianDate(info.getValue())
		},

		{
			accessorKey: 'endDate',
			header: ({ column }) =>
				renderComponent(DataTableSort, {
					name: 'End Date',
					onclick: column.getToggleSortingHandler()
				}),
			sortable: true,
			cell: (info) => formatEthiopianDate(info.getValue())
		},

		{
			accessorKey: '',
			header: 'Address',
			sortable: true,
			cell: ({ row }) => {
				// You can pass whatever you need from `row.original` to the component
				return renderComponent(Address, {
					street: row?.original?.address?.street,
					buildingNumber: row?.original?.address?.buildingNumber,
					floor: row?.original?.address?.floor,
					subcity: row?.original?.address?.subcity,
					kebele: row?.original?.address?.kebele,
					houseNumber: row?.original?.address?.houseNumber
				});
			}
		},
		{
			accessorKey: 'status',
			header: 'Status',
			sortable: true,
			cell: ({ row }) => {
				return renderComponent(Statuses, {
					status: row.original.status ? 'Active' : 'InActive'
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
					name: row.original?.name,
					phone: row.original?.phone,
					startDate: row.original?.startDate,
					endDate: row.original?.endDate,
					status: row.original?.status,
					data: editForm,
					icon: true
				});
			}
		},
		{
			accessorKey: '',
			header: 'Edit Address',
			sortable: true,
			cell: ({ row }) => {
				// You can pass whatever you need from `row.original` to the component
				return renderComponent(AddressEdit, {
					address: row.original?.address,
					subcityList: subcityList,
					data: addressForm
				});
			}
		}
	];

	const { form, errors, enhance, delayed, message, allErrors } = superForm(addForm, {
		resetForm: false
	});
	import { toast } from 'svelte-sonner';
	import Address from '$lib/components/Table/address.svelte';
	import AddressEdit from './editAddress.svelte';

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

<DialogComp variant="default" title="Add Site" IconComp={Plus}>
	<form
		action="?/addSite"
		use:enhance
		method="post"
		id="edit"
		class="flex w-full flex-col gap-4 p-4 pt-8"
		enctype="multipart/form-data"
	>
		<Errors allErrors={$allErrors} />
		<InputComp
			label="Name"
			name="name"
			type="text"
			{form}
			{errors}
			placeholder="Enter Site Name"
			required
		/>
		<InputComp
			label="Phone"
			name="phone"
			type="tel"
			{form}
			{errors}
			placeholder="Enter Site Phone Number"
			required
		/>
		<InputComp label="Start Date" name="startDate" type="date" {form} {errors} required />
		<InputComp label="End Date" name="endDate" type="date" {form} {errors} required />

		<InputComp
			label="Status"
			name="status"
			type="select"
			{form}
			{errors}
			required
			items={isActives}
		/>

		<InputComp
			label="Subcity"
			name="subcity"
			type="combo"
			{form}
			{errors}
			required
			items={subcityList}
		/>
		<InputComp label="Street" name="street" type="text" {form} {errors} required />
		<InputComp label="Kebele" name="kebele" type="text" {form} {errors} required />
		<InputComp
			label="Building Name or Number"
			name="buildingNumber"
			type="text"
			{form}
			{errors}
			required
		/>
		<InputComp label="Floor" name="floor" type="number" {form} {errors} required />
		<InputComp label="House Number" name="houseNumber" type="text" {form} {errors} required />
		<InputComp
			label="Status"
			name="status"
			type="select"
			{form}
			{errors}
			required
			items={[
				{ value: true, name: 'Active' },
				{ value: false, name: 'Inactive' }
			]}
		/>

		<Button type="submit" class="mt-4" form="edit">
			{#if $delayed}
				<LoadingBtn name="Adding Site" />
			{:else}
				<Plus class="h-4 w-4" />

				Add Site
			{/if}
		</Button>
	</form>
</DialogComp>

{#key data}
	<DataTable {columns} {data} search={true} fileName="Contact" />
{/key}
