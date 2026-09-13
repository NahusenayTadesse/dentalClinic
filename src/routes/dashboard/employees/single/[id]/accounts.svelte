<script lang="ts">
	import { renderComponent } from '$lib/components/ui/data-table/index.js';
	import DeleteEntity from '$lib/components/DeleteEntity.svelte';
	import DataTable from '$lib/components/Table/data-table.svelte';
	import Copy from '$lib/Copy.svelte';
	import DataTableSort from '$lib/components/Table/data-table-sort.svelte';
	import Statuses from '$lib/components/Table/statuses.svelte';
	import Edit from './editAccount.svelte';
	import DataTableLinks from '$lib/components/Table/data-table-links.svelte';
	import DialogComp from '$lib/formComponents/DialogComp.svelte';
	import InputComp from '$lib/formComponents/InputComp.svelte';
	import Errors from '$lib/formComponents/Errors.svelte';
	import { superForm } from 'sveltekit-superforms/client';
	import { Button } from '$lib/components/ui/button/index.js';
	import LoadingBtn from '$lib/formComponents/LoadingBtn.svelte';

	import { Plus } from '@lucide/svelte';
	import type { Infer, SuperValidated } from 'sveltekit-superforms';

	import type { EditAccount, AddAccount } from './schema';
	const isActives = [
		{ value: true, name: 'Active' },
		{ value: false, name: 'Inactive' }
	];

	let {
		data,
		form: editForm,
		addForm,
		paymentMethods,
		canDelete = false
	}: {
		data: any;
		form: SuperValidated<Infer<EditAccount>>;
		addForm: SuperValidated<Infer<AddAccount>>;
		paymentMethods: Item[];
		/** Only a super admin gets the per-row delete button. */
		canDelete?: boolean;
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
			accessorKey: 'paymentMethod',
			header: ({ column }) =>
				renderComponent(DataTableSort, {
					name: 'Bank',
					onclick: column.getToggleSortingHandler()
				}),
			cell: ({ row }) => {
				// You can pass whatever you need from `row.original` to the component
				return renderComponent(Edit, {
					id: row.original?.id,
					name: row.original?.paymentMethod,
					paymentMethods: paymentMethods,
					paymentMethodId: row.original?.paymentMethodId,
					accountDetail: row.original?.accountDetail,
					status: row.original?.status,
					data: editForm,
					icon: false
				});
			}
		},

		{
			accessorKey: 'accountDetail',
			header: ({ column }) =>
				renderComponent(DataTableSort, {
					name: 'Account Detail',
					onclick: column.getToggleSortingHandler()
				})
		},
		{
			accessorKey: 'status',
			header: 'Status',
			cell: ({ row }) => {
				return renderComponent(Statuses, {
					status: row.original.status ? 'Active' : 'InActive',
					name: row.original.addedBy,
					entity: 'user',

					target: '_blank'
				});
			}
		},

		{
			accessorKey: 'addedBy',
			header: 'Added By',
			cell: ({ row }) => {
				return renderComponent(DataTableLinks, {
					id: row.original.addedById,
					name: row.original.addedBy,
					entity: 'user',

					target: '_blank'
				});
			}
		},

		{
			accessorKey: '',
			header: 'Edit',
			cell: ({ row }) => {
				// You can pass whatever you need from `row.original` to the component
				return renderComponent(Edit, {
					id: row.original?.id,
					paymentMethods: paymentMethods,
					name: row.original?.paymentMethod,
					paymentMethodId: row.original?.paymentMethodId,
					accountDetail: row.original?.accountDetail,
					status: row.original?.status,
					data: editForm,
					icon: true
				});
			}
		},

		{
			id: 'delete',
			header: '',
			enableSorting: false,
			// Renders nothing unless `canDelete`; the action re-checks on the server.
			cell: ({ row }) =>
				renderComponent(DeleteEntity, {
					entity: 'Bank Account',
					name: row.original?.paymentMethod,
					id: row.original?.id,
					action: '?/deleteAccount',
					icon: true,
					canDelete
				})
		}
	];
	let disabled = $state(false);

	const { form, errors, enhance, delayed, message, allErrors } = superForm(addForm, {
		resetForm: false
		// onChange() {
		// 	if ($form.paymentMethodId === 8) {
		// 		$form.accountDetail = 'No Account';
		// 		disabled = true;
		// 	} else {
		// 		disabled = false;
		// 	}
		// }
	});

	let prevPaymentMethod = $state($form.paymentMethodId);

	$effect(() => {
		const current = $form.paymentMethodId;

		if (current !== prevPaymentMethod) {
			if (current === 8) {
				$form.accountDetail = 'No Account';
				disabled = true;
			} else {
				if (prevPaymentMethod === 8) {
					$form.accountDetail = '';
				}
				disabled = false;
			}
			prevPaymentMethod = current;
		}
	});
	import { toast } from 'svelte-sonner';
	import type { Item } from '$lib/global.svelte';

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

<DialogComp variant="default" title="Add Account" IconComp={Plus}>
	<form
		action="?/addAccount"
		use:enhance
		method="post"
		id="edit"
		class="flex w-full flex-col gap-4 p-4 pt-8"
	>
		<Errors allErrors={$allErrors} />
		<InputComp
			label="Bank"
			name="paymentMethodId"
			type="select"
			{form}
			{errors}
			required
			items={paymentMethods}
		/>

		<InputComp
			label="Account Detail"
			name="accountDetail"
			type="text"
			{form}
			{errors}
			required={disabled}
			placeholder="Enter Account Details"
		/>
		<!-- <input type="text" name="accountDetail" bind:value={$form.accountDetail} /> -->

		<InputComp
			label="Statu!s"
			name="status"
			type="select"
			{form}
			{errors}
			required
			items={isActives}
		/>
		<Button type="submit" class="mt-4" form="edit">
			{#if $delayed}
				<LoadingBtn name="Adding Account" />
			{:else}
				<Plus class="h-4 w-4" />

				Add Account
			{/if}
		</Button>
	</form>
</DialogComp>

{#key data}
	<DataTable {columns} {data} search={true} fileName="Bank Accounts" />
{/key}
