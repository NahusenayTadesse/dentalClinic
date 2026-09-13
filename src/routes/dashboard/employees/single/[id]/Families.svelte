<script lang="ts">
	import { createForm } from '$lib/forms/createForm';
	import { renderComponent } from '$lib/components/ui/data-table/index.js';
	import DeleteEntity from '$lib/components/DeleteEntity.svelte';
	import DataTable from '$lib/components/Table/data-table.svelte';
	import Copy from '$lib/Copy.svelte';
	import DataTableSort from '$lib/components/Table/data-table-sort.svelte';
	import Statuses from '$lib/components/Table/statuses.svelte';
	import Edit from './editFamily.svelte';
	import DataTableLinks from '$lib/components/Table/data-table-links.svelte';
	import DialogComp from '$lib/formComponents/DialogComp.svelte';
	import InputComp from '$lib/formComponents/InputComp.svelte';
	import Errors from '$lib/formComponents/Errors.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import LoadingBtn from '$lib/formComponents/LoadingBtn.svelte';

	const relationShips = [
		'mother',
		'father',
		'spouse',
		'son',
		'daughter',
		'grandchild',
		'grandfather',
		'grandmother',
		'uncle',
		'aunt',
		'brother',
		'sister',
		'other'
	].map((v) => ({
		value: v,
		name: v.charAt(0).toUpperCase() + v.slice(1)
	}));

	const genders = [
		{ value: 'male', name: 'Male' },
		{ value: 'female', name: 'Female' }
	];

	import { Plus } from '@lucide/svelte';
	import type { SuperValidated } from 'sveltekit-superforms';

	let {
		data,
		form: editForm,
		addForm,
		canDelete = false
	}: {
		data: any;
		form: SuperValidated<EditFamily>;
		addForm: SuperValidated<AddFamily>;
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
			accessorKey: 'name',
			header: ({ column }) =>
				renderComponent(DataTableSort, {
					name: 'Name',
					onclick: column.getToggleSortingHandler()
				}),
			cell: ({ row }) => {
				// You can pass whatever you need from `row.original` to the component
				return renderComponent(Edit, {
					id: row.original?.id,
					name: row.original?.name,
					phone: row.original?.phone,
					email: row.original?.email,
					gender: data[row.index]?.gender,
					emergencyContact: row.original?.emergencyContact,
					relationship: row.original?.relationship,
					otherRelationship: row.original?.otherRelationship,
					data: editForm,
					icon: false,
					status: row.original?.status
				});
			}
		},

		{
			accessorKey: 'phone',
			header: ({ column }) =>
				renderComponent(DataTableSort, {
					name: 'Phone',
					onclick: column.getToggleSortingHandler()
				}),
			cell: ({ row }) => {
				// You can pass whatever you need from `row.original` to the component
				return renderComponent(Copy, {
					data: row.original.phone
				});
			}
		},

		{
			accessorKey: 'email',
			header: ({ column }) =>
				renderComponent(DataTableSort, {
					name: 'Email',
					onclick: column.getToggleSortingHandler()
				}),
			cell: ({ row }) => {
				// You can pass whatever you need from `row.original` to the component
				return renderComponent(Copy, {
					data: row.original.email
				});
			}
		},
		{
			accessorKey: 'gender',
			header: ({ column }) =>
				renderComponent(DataTableSort, {
					name: 'Gender',
					onclick: column.getToggleSortingHandler()
				})
		},

		{
			accessorKey: 'relationship',
			header: ({ column }) =>
				renderComponent(DataTableSort, {
					name: 'RelationShip',
					onclick: column.getToggleSortingHandler()
				}),
			cell: ({ row }) => {
				return row.original.relationship === 'other'
					? row.original.otherRelationship
					: row.original.relationship;
			}
		},

		{
			accessorKey: 'emergencyContact',
			header: ({ column }) =>
				renderComponent(DataTableSort, {
					name: 'Emergency Contact',
					onclick: column.getToggleSortingHandler()
				}),
			cell: ({ row }) => {
				return renderComponent(Statuses, {
					status: row.original.emergencyContact ? 'Yes' : 'No'
				});
			}
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
					name: row.original?.name,
					phone: row.original?.phone,
					email: row.original?.email,
					gender: data[row.index]?.gender,
					emergencyContact: row.original?.emergencyContact,
					relationship: row.original?.relationship,
					otherRelationship: row.original?.otherRelationship,
					data: editForm,
					icon: true,
					status: row.original?.status
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
					entity: 'Family Member',
					name: row.original?.name,
					id: row.original?.id,
					action: '?/deleteFamily',
					icon: true,
					canDelete
				})
		}
	];

	let open = $state(false);

	const { form, errors, enhance, delayed, allErrors } = createForm(addForm, addFamily, {
		// An add form starts empty again, so reopening it does not show the entry just saved.
		resetForm: true,
		// Closed only on success, so a rejected save keeps the dialog and its errors on screen.
		onUpdated({ form }) {
			if (form.message?.type === 'success') open = false;
		}
	});
	import { addFamily, type AddFamily } from './schema';
	import EditFamily from './editFamily.svelte';
</script>

<DialogComp bind:open variant="default" title="Add Family Members" IconComp={Plus}>
	<form
		action="?/addFamily"
		use:enhance
		method="post"
		id="edit"
		class="flex w-full flex-col gap-4 p-4"
	>
		<Errors allErrors={$allErrors} />
		<input type="hidden" name="id" value={$form.id} />
		<InputComp
			label="Name"
			name="name"
			type="text"
			{form}
			{errors}
			placeholder="Enter Name of Family Member"
		/>
		<InputComp
			label="Phone"
			name="phone"
			type="tel"
			{form}
			{errors}
			placeholder="Enter Phone Number"
		/>

		<InputComp
			label="Email"
			name="email"
			type="email"
			{form}
			{errors}
			required={false}
			placeholder="Enter Email"
		/>
		<InputComp
			label="Gender"
			name="gender"
			type="select"
			{form}
			{errors}
			items={[
				{ value: 'male', name: 'Male' },
				{ value: 'female', name: 'Female' }
			]}
		/>

		<InputComp
			label="Relationship to Employee"
			name="relationship"
			type="combo"
			{form}
			{errors}
			items={relationShips}
		/>
		{#if $form.relationship === 'other'}
			<InputComp
				label="Relationship to Employee"
				name="otherRelationship"
				type="text"
				{form}
				{errors}
			/>
		{/if}

		<input hidden bind:value={$form.otherRelationship} name="otherRelationship" />

		<InputComp
			label="Is this Family Member an Emergency Contact?"
			name="emergencyContact"
			type="select"
			{form}
			{errors}
			items={[
				{ value: true, name: 'Emergency Contact' },
				{ value: false, name: 'Not Emergency Contact' }
			]}
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

		<Button type="submit" class="mt-4" form="edit">
			{#if $delayed}
				<LoadingBtn name="Adding Family Member" />
			{:else}
				<Plus class="h-4 w-4" />

				Add Family Member
			{/if}
		</Button>
	</form>
</DialogComp>

{#key data}
	<DataTable {columns} {data} search={true} fileName="Family" />
{/key}
