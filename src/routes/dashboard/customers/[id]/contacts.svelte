<script lang="ts">
	import { renderComponent } from '@nahu/admin-kit/components/ui/data-table/index.js';
	import DeleteEntity from '@nahu/admin-kit/components/DeleteEntity.svelte';
	import DataTable from '$lib/components/Table/data-table.svelte';
	import Copy from '@nahu/admin-kit/Copy.svelte';
	import DataTableSort from '@nahu/admin-kit/components/Table/data-table-sort.svelte';
	import Statuses from '@nahu/admin-kit/components/Table/statuses.svelte';
	import Edit from './editContacts.svelte';
	import DataTableLinks from '$lib/components/Table/data-table-links.svelte';
	import DialogComp from '@nahu/admin-kit/formComponents/DialogComp.svelte';
	import InputComp from '$lib/formComponents/InputComp.svelte';
	import Errors from '@nahu/admin-kit/formComponents/Errors.svelte';
	import { superForm } from 'sveltekit-superforms/client';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import LoadingBtn from '@nahu/admin-kit/formComponents/LoadingBtn.svelte';

	import { Plus } from '@lucide/svelte';
	import type { SuperValidated } from 'sveltekit-superforms';
	import type { Item } from '$lib/global.svelte';
	import { formatEthiopianDate } from '$lib/global.svelte';
	import type { EditContact, AddContact } from './schema';
	const isActives = [
		{ value: true, name: 'Active' },
		{ value: false, name: 'Inactive' }
	];

	let {
		data,
		form: editForm,
		addForm,
		canDelete = false
	}: {
		data: any;
		form: SuperValidated<EditContact>;
		addForm: SuperValidated<AddContact>;
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
			accessorKey: 'contactType',
			header: ({ column }) =>
				renderComponent(DataTableSort, {
					name: 'Contact Type',
					onclick: column.getToggleSortingHandler()
				}),
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
					contactType: row.original?.contactType,
					contactDetail: row.original?.contactDetail,
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
					entity: 'Contact',
					name: row.original?.contactDetail,
					id: row.original?.id,
					action: '?/deleteContact',
					icon: true,
					canDelete
				})
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
		<InputComp
			label="Contact Type"
			name="contactType"
			type="select"
			{form}
			{errors}
			required
			items={[
				{ value: 'phone', name: 'Phone Number' },
				{ value: 'email', name: 'Email' },
				{ value: 'telegram', name: 'Telegram' },
				{ value: 'whatsapp', name: 'WhatsApp' },
				{ value: 'instagram', name: 'Instagram' }
			]}
		/>
		<InputComp
			label="Contact Detail"
			name="contactDetail"
			type={$form?.contactType === 'phone'
				? 'tel'
				: $form?.contactType === 'email'
					? 'email'
					: 'text'}
			{form}
			{errors}
			required
			placeholder={`Enter ${
				$form?.contactType
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
