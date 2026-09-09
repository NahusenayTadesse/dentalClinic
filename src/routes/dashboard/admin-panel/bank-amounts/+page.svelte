<script>
	import { renderComponent } from '$lib/components/ui/data-table/index.js';
	import DataTable from '$lib/components/Table/data-table.svelte';
	import DeleteEntity from '$lib/components/DeleteEntity.svelte';
	import DataTableLinks from '$lib/components/Table/data-table-links.svelte';
	import DataTableSort from '$lib/components/Table/data-table-sort.svelte';
	import DialogComp from '$lib/formComponents/DialogComp.svelte';
	import { Button } from '$lib/components/ui/button/index';
	import Edit from './edit.svelte';
	import RiskAcknowledgement from '$lib/formComponents/RiskAcknowledgement.svelte';
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
			accessorKey: 'bank',
			header: ({ column }) =>
				renderComponent(DataTableSort, {
					name: 'Bank',
					onclick: column.getToggleSortingHandler()
				}),
			cell: ({ row }) => {
				// You can pass whatever you need from `row.original` to the component
				return renderComponent(Edit, {
					id: row.original.id,
					bank: row.original.bank,
					amount: row.original.amount,
					account: row.original.account,
					action: '?/edit',
					banks: data?.banks,
					data: data.editForm,
					icon: false
				});
			}
		},
		{
			accessorKey: 'account',
			header: ({ column }) =>
				renderComponent(DataTableSort, {
					name: 'Account Number',
					onclick: column.getToggleSortingHandler()
				}),
			cell: ({ row }) => {
				// You can pass whatever you need from `row.original` to the component
				return renderComponent(Copy, {
					data: row.original.account
				});
			}
		},

		{
			accessorKey: 'amount',
			header: ({ column }) =>
				renderComponent(DataTableSort, {
					name: 'Current Amount',
					onclick: column.getToggleSortingHandler()
				}),
			cell: ({ row }) => {
				// You can pass whatever you need from `row.original` to the component
				return formatETB(Number(row.original.amount), true);
			}
		},
		{
			accessorKey: 'numberOfChanges',
			header: ({ column }) =>
				renderComponent(DataTableSort, {
					name: 'Number of Changes',
					onclick: column.getToggleSortingHandler()
				}),
			cell: ({ row }) => {
				// You can pass whatever you need from `row.original` to the component
				return row.original.numberOfChanges + ' Changes';
			}
		},
		{
			accessorKey: 'createdBy',
			header: ({ column }) =>
				renderComponent(DataTableSort, {
					name: 'Created By',
					onclick: column.getToggleSortingHandler()
				}),
			cell: ({ row }) => {
				// You can pass whatever you need from `row.original` to the component
				return renderComponent(DataTableLinks, {
					id: row.original.createdById,
					name: row.original.createdBy,
					link: '/dashboard/users'
				});
			}
		},

		{
			accessorKey: '',
			header: 'Edit',
			cell: ({ row }) => {
				// You can pass whatever you need from `row.original` to the component
				return renderComponent(Edit, {
					id: row.original.id,
					bank: row.original.bank,
					amount: row.original.amount,
					account: row.original.account,
					action: '?/edit',
					banks: data?.banks,
					data: data.editForm,
					icon: true
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
					entity: 'Bank Amount',
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

	let acknowledgeManualChange = $state(false);

	import { toast } from 'svelte-sonner';
	import { formatETB } from '$lib/global.svelte';
	import FilterMenu from '$lib/components/Table/FilterMenu.svelte';
	import Copy from '$lib/Copy.svelte';
	$effect(() => {
		if ($message) {
			if ($message.type === 'error') {
				toast.error($message.text);
			} else {
				toast.success($message.text);
			}
		}
	});

	let filteredList = $derived(data?.allPaymentMethods);
</script>

<svelte:head>
	<title>Bank Amounts</title>
</svelte:head>

{#key data?.allPaymentMethods}
	<DialogComp title="Add New Bank" IconComp={Plus} variant="default">
		<form action="?/add" use:enhance id="main" class="flex flex-col gap-4" method="post">
			<InputComp
				{form}
				{errors}
				label="Bank"
				type="combo"
				name="bank"
				required={true}
				items={data?.banks}
			/>
			<InputComp
				{form}
				{errors}
				label="Account Number"
				type="text"
				name="account"
				required={true}
			/>
			<InputComp {form} {errors} label="Amount" type="number" name="amount" required={true} />

			<RiskAcknowledgement
				show={true}
				name="acknowledgeManualChange"
				bind:checked={acknowledgeManualChange}
				title="This is an opening balance, not a payment"
				message="The figure is written straight onto the account. Nothing appears in the bank history to explain it, so every later total is measured from here."
			/>

			<Button type="submit" form="main">
				{#if $delayed}
					<LoadingBtn name="Adding Bank" />
				{:else}
					<Plus /> Add Bank
				{/if}
			</Button>
		</form>
	</DialogComp>
	<br />
	<br />
	<FilterMenu
		bind:filteredList
		data={data?.allPaymentMethods}
		filterKeys={['bankName', 'numberOfChanges', 'createdBy']}
	/>
	<DataTable {columns} data={data?.allPaymentMethods} search={true} fileName="Bank Amounts" />
{/key}
