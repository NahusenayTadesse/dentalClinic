<script lang="ts">
	import { renderComponent } from '$lib/components/ui/data-table/index.js';
	import DataTable from '$lib/components/Table/data-table.svelte';
	import Copy from '$lib/Copy.svelte';
	import DataTableSort from '$lib/components/Table/data-table-sort.svelte';
	import Statuses from '$lib/components/Table/statuses.svelte';
	import Edit from './editContract.svelte';
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
	import { formatETB, formatEthiopianDate, formatEthiopianYear } from '$lib/global.svelte';
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
			accessorKey: 'contractYear',
			header: ({ column }) =>
				renderComponent(DataTableSort, {
					name: 'Contract Year',
					onclick: column.getToggleSortingHandler()
				}),
			sortable: true,
			cell: ({ row }) => {
				// You can pass whatever you need from `row.original` to the component
				return renderComponent(Edit, {
					data: editForm,
					id: row.original.id,
					service: row.original.serviceId,
					contractDate: row.original.signedDate,
					contractYear: row.original.contractYear,
					startDate: row.original.startDate,
					endDate: row.original.endDate,
					contractFile: row.original.contractFile,
					monthlyAmount: row.original.monthlyAmount,
					commissionConsidered: row.original.officeCommission,
					signingOfficer: row.original.signingOfficer,
					serviceList,
					status: row.original.status,
					icon: false
				});
			}
		},
		{
			accessorKey: 'addPayment',
			header: 'Add Payment',
			sortable: true,
			cell: ({ row }) => {
				return renderComponent(DataTableLinks, {
					id: row.original.status ? row.original.id : '',
					name: '+ Add Monthly Payment',
					link: '/dashboard/sites/' + page.params.id + '/payments',
					target: '_blank'
				});
			}
		},

		{
			accessorKey: 'paymentHistory',
			header: 'Payment History',
			sortable: true,
			cell: ({ row }) => {
				return renderComponent(DataTableLinks, {
					id: row.original.id + '/payment-history',
					name: 'Payment History',
					link: '/dashboard/sites/' + page.params.id + '/payments',
					target: '_blank'
				});
			}
		},
		{
			accessorKey: 'serviceName',
			header: ({ column }) =>
				renderComponent(DataTableSort, {
					name: 'Service',
					onclick: column.getToggleSortingHandler()
				}),
			sortable: true
		},

		{
			accessorKey: 'monthlyAmount',
			header: ({ column }) =>
				renderComponent(DataTableSort, {
					name: 'Monthly Amount',
					onclick: column.getToggleSortingHandler()
				}),
			sortable: true,
			cell: (info) => {
				return formatETB(info.getValue(), true);
			}
		},
		{
			accessorKey: 'startDate',
			header: ({ column }) =>
				renderComponent(DataTableSort, {
					name: 'Contract Start Date',
					onclick: column.getToggleSortingHandler()
				}),
			sortable: true,
			cell: (info) => {
				return formatEthiopianDate(info.getValue());
			}
		},
		{
			accessorKey: 'endDate',
			header: ({ column }) =>
				renderComponent(DataTableSort, {
					name: 'Contract End Date',
					onclick: column.getToggleSortingHandler()
				}),
			sortable: true,
			cell: (info) => {
				return formatEthiopianDate(info.getValue());
			}
		},
		{
			accessorKey: 'signedDate',
			header: ({ column }) =>
				renderComponent(DataTableSort, {
					name: 'Signed On',
					onclick: column.getToggleSortingHandler()
				}),
			sortable: true,
			cell: (info) => {
				return formatEthiopianDate(info.getValue());
			}
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
			accessorKey: 'officeCommission',
			header: 'Office Commission',
			sortable: true,
			cell: ({ row }) => {
				return renderComponent(Statuses, {
					status: row.original.status ? 'Yes' : 'No'
				});
			}
		},
		{
			accessorKey: 'contractFile',
			header: 'Contract File',
			sortable: true,
			cell: ({ row }) => {
				return renderComponent(DataTableLinks, {
					id: row.original.contractFile ? row.original.contractFile : '',
					name: row.original.contractFile ? 'Contract File' : 'File Not Uploaded',
					link: '/dashboard/files',
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
					data: editForm,
					id: row.original.id,
					service: row.original.serviceId,
					contractDate: row.original.signedDate,
					contractYear: row.original.contractYear,
					startDate: row.original.startDate,
					endDate: row.original.endDate,
					contractFile: row.original.contractFile,
					monthlyAmount: row.original.monthlyAmount,
					commissionConsidered: row.original.officeCommission,
					signingOfficer: row.original.signingOfficer,
					serviceList: row.original.serviceList,
					status: row.original.status,
					icon: true
				});
			}
		}
	];

	const { form, errors, enhance, delayed, message, allErrors } = superForm(addForm, {
		resetForm: false
	});
	import { toast } from 'svelte-sonner';
	import { page } from '$app/state';

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

<DialogComp variant="default" title="Add Contract" IconComp={Plus}>
	<form
		action="?/addContract"
		use:enhance
		method="post"
		id="edit"
		class="flex w-full flex-col gap-4 p-2 pt-8"
		enctype="multipart/form-data"
	>
		<Errors allErrors={$allErrors} />
		<InputComp
			label="Service Contracted"
			name="service"
			type="combo"
			{form}
			{errors}
			required
			items={serviceList}
		/>
		<InputComp
			label="Monthly Amount"
			name="monthlyAmount"
			type="number"
			{form}
			{errors}
			required
			placeholder="Enter monthly Amount"
		/>
		<InputComp
			label="Contract Start Date"
			name="startDate"
			type="date"
			{form}
			{errors}
			year={true}
			required
			placeholder="Enter start date"
		/>
		<InputComp
			label="Contract End Date"
			name="endDate"
			type="date"
			{form}
			year={true}
			{errors}
			required
			placeholder="Enter end date"
		/>
		<InputComp
			label="Contract Year"
			name="contractYear"
			type="number"
			{form}
			min="1900"
			max="2099"
			{errors}
			required
			placeholder="Enter end date"
		/>

		<InputComp
			label="Contract Signing Date"
			name="contractDate"
			type="date"
			{form}
			{errors}
			required
			placeholder="Enter signing date"
		/>
		<InputComp
			label="Contract File"
			name="contractFile"
			type="file"
			{form}
			{errors}
			required
			placeholder="Upload contract pdf or image"
		/>

		<InputComp
			label="Office Commission"
			name="commissionConsidered"
			type="select"
			{form}
			{errors}
			required={true}
			items={[
				{ value: true, name: 'Yes, Calculate commission for Office Workers for this contract' },
				{
					value: false,
					name: 'No, Do not calculate commission for Office Workers for this contract'
				}
			]}
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
				<LoadingBtn name="Adding Contract" />
			{:else}
				<Plus class="h-4 w-4" />

				Add Contract
			{/if}
		</Button>
	</form>
</DialogComp>

{#key data}
	<DataTable {columns} {data} search={true} fileName="Contract" />
{/key}
