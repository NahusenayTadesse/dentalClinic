<script lang="ts">
	import { renderComponent } from '$lib/components/ui/data-table/index.js';
	import DeleteEntity from '$lib/components/DeleteEntity.svelte';
	import DataTable from '$lib/components/Table/data-table.svelte';
	import Copy from '$lib/Copy.svelte';
	import DataTableSort from '$lib/components/Table/data-table-sort.svelte';
	import Statuses from '$lib/components/Table/statuses.svelte';
	import Edit from './editExperience.svelte';
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
	import type { EditExperience, AddExperience } from './schema';

	let {
		data,
		form: editForm,
		addForm,
		canDelete = false
	}: {
		data: any;
		form: SuperValidated<Infer<EditExperience>>;
		addForm: SuperValidated<Infer<AddExperience>>;
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
			accessorKey: 'companyName',
			header: ({ column }) =>
				renderComponent(DataTableSort, {
					name: 'Company Name',
					onclick: column.getToggleSortingHandler()
				}),
			cell: ({ row }) => {
				// You can pass whatever you need from `row.original` to the component
				return renderComponent(Edit, {
					id: row.original?.id,
					companyName: row.original?.companyName,
					position: row.original?.position,
					startDate: row.original?.startDate,
					endDate: row.original?.endDate,
					description: row.original?.description,
					certificate: row.original?.certificate,
					data: editForm,
					icon: false
				});
			}
		},

		{
			accessorKey: 'position',
			header: ({ column }) =>
				renderComponent(DataTableSort, {
					name: 'Position',
					onclick: column.getToggleSortingHandler()
				})
		},

		{
			accessorKey: 'startDate',
			header: ({ column }) =>
				renderComponent(DataTableSort, {
					name: 'Start Date',
					onclick: column.getToggleSortingHandler()
				}),
			cell: ({ row }) => {
				return formatEthiopianDate(row.original.startDate);
			}
		},
		{
			accessorKey: 'endDate',
			header: ({ column }) =>
				renderComponent(DataTableSort, {
					name: 'End Date',
					onclick: column.getToggleSortingHandler()
				}),
			cell: ({ row }) => {
				return formatEthiopianDate(row.original.endDate);
			}
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
					link: '/dashboard/admin-panel/users',

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
					companyName: row.original?.companyName,
					position: row.original?.position,
					startDate: row.original?.startDate,
					endDate: row.original?.endDate,
					description: row.original?.description,
					certificate: row.original?.certificate,
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
					entity: 'Work Experience',
					name: row.original?.companyName,
					id: row.original?.id,
					action: '?/deleteExperience',
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

<DialogComp variant="default" title="Add Experience" IconComp={Plus}>
	<form
		action="?/addExperience"
		use:enhance
		method="post"
		id="edit"
		class="flex w-full flex-col gap-4 p-4 pt-8"
		enctype="multipart/form-data"
	>
		<Errors allErrors={$allErrors} />
		<InputComp
			label="Company Name"
			name="companyName"
			type="text"
			{form}
			{errors}
			placeholder="Enter Company Name"
		/>
		<InputComp label="Position" name="position" type="text" {form} {errors} required />

		<InputComp
			label="Work and Experience Description"
			name="description"
			type="textarea"
			{form}
			{errors}
			required={false}
			rows={5}
			placeholder="Enter Work Experience"
		/>
		<InputComp
			label="Start Date"
			name="startDate"
			type="date"
			{form}
			{errors}
			oldDays
			futureDays={false}
			year
		/>

		<InputComp
			label="End Date"
			name="endDate"
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
				<LoadingBtn name="Adding Work Experience" />
			{:else}
				<Plus class="h-4 w-4" />

				Add Work Experience
			{/if}
		</Button>
	</form>
</DialogComp>

{#key data}
	<DataTable {columns} {data} search={true} fileName="Qualifications" />
{/key}
