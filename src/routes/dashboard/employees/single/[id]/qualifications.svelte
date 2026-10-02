<script lang="ts">
	import { createForm } from '@nahu/admin-kit/forms/createForm.js';
	import { renderComponent } from '@nahu/admin-kit/components/ui/data-table/index.js';
	import DeleteEntity from '@nahu/admin-kit/components/DeleteEntity.svelte';
	import DataTable from '$lib/components/Table/data-table.svelte';
	import Copy from '@nahu/admin-kit/Copy.svelte';
	import DataTableSort from '@nahu/admin-kit/components/Table/data-table-sort.svelte';
	import Statuses from '@nahu/admin-kit/components/Table/statuses.svelte';
	import Edit from './editQualification.svelte';
	import DataTableLinks from '$lib/components/Table/data-table-links.svelte';
	import DialogComp from '@nahu/admin-kit/formComponents/DialogComp.svelte';
	import InputComp from '$lib/formComponents/InputComp.svelte';
	import Errors from '@nahu/admin-kit/formComponents/Errors.svelte';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import LoadingBtn from '@nahu/admin-kit/formComponents/LoadingBtn.svelte';

	import { Plus } from '@lucide/svelte';
	import type { SuperValidated } from 'sveltekit-superforms';
	import type { Item } from '$lib/global.svelte';
	import { formatEthiopianDate } from '$lib/global.svelte';
	import { addQualification, type EditQualification, type AddQualification } from './schema';

	let {
		data,
		form: editForm,
		eduLevel,
		addForm,
		canDelete = false
	}: {
		data: any;
		form: SuperValidated<EditQualification>;
		eduLevel: Item[];
		addForm: SuperValidated<AddQualification>;
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
			accessorKey: 'field',
			header: ({ column }) =>
				renderComponent(DataTableSort, {
					name: 'Field',
					onclick: column.getToggleSortingHandler()
				}),
			cell: ({ row }) => {
				// You can pass whatever you need from `row.original` to the component
				return renderComponent(Edit, {
					id: row.original?.id,
					field: row.original?.field,
					educationLevel: row.original?.educationalLevelId,
					schoolName: row.original?.schoolName,
					graduationDate: row.original?.graduationDate,
					certificate: row.original?.certificate,
					data: editForm,
					icon: false,
					eduLevel: eduLevel
				});
			}
		},

		{
			accessorKey: 'educationalLevel',
			header: ({ column }) =>
				renderComponent(DataTableSort, {
					name: 'Educational Level',
					onclick: column.getToggleSortingHandler()
				})
		},

		{
			accessorKey: 'schoolName',
			header: ({ column }) =>
				renderComponent(DataTableSort, {
					name: 'School Name',
					onclick: column.getToggleSortingHandler()
				})
		},
		{
			accessorKey: 'graduationDate',
			header: ({ column }) =>
				renderComponent(DataTableSort, {
					name: 'Graduation Date',
					onclick: column.getToggleSortingHandler()
				}),
			cell: ({ row }) => {
				return formatEthiopianDate(row.original.graduationDate);
			}
		},
		{
			accessorKey: 'certificate',
			header: ({ column }) =>
				renderComponent(DataTableSort, {
					name: 'Certificate',
					onclick: column.getToggleSortingHandler()
				}),
			cell: ({ row }) => {
				return row.original?.certificate
					? renderComponent(DataTableLinks, {
							id: row.original?.certificate,
							name: 'View Certificate',
							link: '/dashboard/files',

							target: '_blank'
						})
					: 'No Certificate Added';
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
					field: row.original?.field,
					educationLevel: row.original?.educationalLevelId,
					schoolName: row.original?.schoolName,
					certificate: row.original?.certificate,
					graduationDate: row.original?.graduationDate,
					data: editForm,
					icon: true,
					eduLevel: eduLevel
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
					entity: 'Qualification',
					name: row.original?.field,
					id: row.original?.id,
					action: '?/deleteQualification',
					icon: true,
					canDelete
				})
		}
	];

	let open = $state(false);

	const { form, errors, enhance, delayed, allErrors } = createForm(addForm, addQualification, {
		// An add form starts empty again, so reopening it does not show the entry just saved.
		resetForm: true,
		// Closed only on success, so a rejected save keeps the dialog and its errors on screen.
		onUpdated({ form }) {
			if (form.message?.type === 'success') open = false;
		}
	});
</script>

<DialogComp bind:open variant="default" title="Add Qualifications" IconComp={Plus}>
	<form
		action="?/addQualification"
		use:enhance
		method="post"
		id="edit"
		class="flex w-full flex-col gap-4 p-4 pt-8"
		enctype="multipart/form-data"
	>
		<Errors allErrors={$allErrors} />
		<InputComp
			label="Field"
			name="field"
			type="text"
			{form}
			{errors}
			placeholder="Enter Field Name"
		/>
		<InputComp
			label="Educational Level"
			name="educationLevel"
			type="combo"
			{form}
			{errors}
			items={eduLevel}
			required
		/>

		<InputComp
			label="School Name "
			name="schoolName"
			type="text"
			{form}
			{errors}
			required
			placeholder="Enter School Name"
		/>
		<InputComp
			label="Graduation Date"
			name="graduationDate"
			type="date"
			{form}
			{errors}
			oldDays
			futureDays={false}
			year
		/>

		<InputComp label="Certificate" name="certificate" type="file" {form} {errors} />

		<Button type="submit" class="mt-4" form="edit">
			{#if $delayed}
				<LoadingBtn name="Adding Qualification" />
			{:else}
				<Plus class="h-4 w-4" />

				Add Qualification
			{/if}
		</Button>
	</form>
</DialogComp>

{#key data}
	<DataTable {columns} {data} search={true} fileName="Qualifications" />
{/key}
