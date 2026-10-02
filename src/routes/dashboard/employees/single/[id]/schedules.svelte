<script lang="ts">
	import { createForm } from '$lib/forms/createForm';
	import { renderComponent } from '@nahu/admin-kit/components/ui/data-table/index.js';
	import DeleteEntity from '$lib/components/DeleteEntity.svelte';
	import DataTable from '$lib/components/Table/data-table.svelte';
	import Copy from '$lib/Copy.svelte';
	import DataTableSort from '@nahu/admin-kit/components/Table/data-table-sort.svelte';
	import Statuses from '$lib/components/Table/statuses.svelte';
	import Edit from './editSchedule.svelte';
	import DataTableLinks from '$lib/components/Table/data-table-links.svelte';
	import DialogComp from '$lib/formComponents/DialogComp.svelte';
	import InputComp from '$lib/formComponents/InputComp.svelte';
	import Errors from '$lib/formComponents/Errors.svelte';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import LoadingBtn from '@nahu/admin-kit/formComponents/LoadingBtn.svelte';

	import { Plus } from '@lucide/svelte';
	import type { SuperValidated } from 'sveltekit-superforms';

	const weekDays = [
		{ value: 0, name: 'Monday' },
		{ value: 1, name: 'Tuesday' },
		{ value: 2, name: 'Wednesday' },
		{ value: 3, name: 'Thursday' },
		{ value: 4, name: 'Friday' },
		{ value: 5, name: 'Saturday' },
		{ value: 6, name: 'Sunday' }
	];

	function formatAMPM(timeString: string): string {
		let [hours, minutes] = timeString.split(':');
		let hoursInt = parseInt(hours);
		const ampm = hoursInt >= 12 ? 'PM' : 'AM';

		hoursInt = hoursInt % 12;
		hoursInt = hoursInt ? hoursInt : 12; // The hour '0' should be '12'

		return `${hoursInt}:${minutes} ${ampm}`;
	}

	let {
		data,
		form: editForm,
		addForm,
		canDelete = false
	}: {
		data: any;
		form: SuperValidated<EditSchedule>;
		addForm: SuperValidated<AddSchedule>;
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
			accessorKey: 'weekDay',
			header: ({ column }) =>
				renderComponent(DataTableSort, {
					name: 'Day',
					onclick: column.getToggleSortingHandler()
				}),
			cell: ({ row }) => {
				// You can pass whatever you need from `row.original` to the component
				return renderComponent(Edit, {
					data: editForm,
					id: row.original?.id,
					weekDay: row.original?.weekDay,
					startTime: row.original?.startTime,
					endTime: row.original?.endTime,
					status: row.original?.status,
					icon: false
				});
			}
		},

		{
			accessorKey: 'startTime',
			header: ({ column }) =>
				renderComponent(DataTableSort, {
					name: 'Start Time',
					onclick: column.getToggleSortingHandler()
				}),
			cell: ({ row }) => {
				// You can pass whatever you need from `row.original` to the component
				return formatAMPM(row.original.startTime);
			}
		},

		{
			accessorKey: 'endTime',
			header: ({ column }) =>
				renderComponent(DataTableSort, {
					name: 'End Time',
					onclick: column.getToggleSortingHandler()
				}),
			cell: ({ row }) => {
				// You can pass whatever you need from `row.original` to the component
				return formatAMPM(row.original.endTime);
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
					data: editForm,
					weekDay: row.original?.weekDay,
					startTime: row.original?.startTime,
					endTime: row.original?.endTime,
					status: row.original?.status,
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
					entity: 'Schedule',
					name: `${row.original?.startTime} - ${row.original?.endTime}`,
					id: row.original?.id,
					action: '?/deleteSchedule',
					icon: true,
					canDelete
				})
		}
	];

	let open = $state(false);

	const { form, errors, enhance, delayed, allErrors } = createForm(addForm, addSchedule, {
		// An add form starts empty again, so reopening it does not show the entry just saved.
		resetForm: true,
		// Closed only on success, so a rejected save keeps the dialog and its errors on screen.
		onUpdated({ form }) {
			if (form.message?.type === 'success') open = false;
		}
	});

	import { addSchedule, type AddFamily, type AddSchedule } from './schema';
	import EditFamily from './editFamily.svelte';
	import type EditSchedule from './editSchedule.svelte';
</script>

<DialogComp bind:open variant="default" title="Add New Schedule" IconComp={Plus}>
	<form
		action="?/addSchedule"
		use:enhance
		method="post"
		id="edit"
		class="flex w-full flex-col gap-4 p-4"
	>
		<Errors allErrors={$allErrors} />
		<input type="hidden" name="id" value={$form.id} />
		<InputComp label="Day" name="weekDay" type="select" {form} {errors} items={weekDays} />
		<InputComp label="Start Time" name="startTime" type="time" {form} {errors} required />
		<InputComp label="End Time" name="endTime" type="time" {form} {errors} required />
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
				<LoadingBtn name="Adding Schedule" />
			{:else}
				<Plus class="h-4 w-4" />

				Add Schedule
			{/if}
		</Button>
	</form>
</DialogComp>

{#key data}
	<DataTable {columns} {data} search={true} fileName="Schedules" />
{/key}
