import { renderComponent } from '$lib/components/ui/data-table/index.js';
import DataTableLinks from '$lib/components/Table/data-table-links.svelte';
import { Checkbox } from '$lib/components/ui/checkbox/index.js';
import DataTableSort from '$lib/components/Table/data-table-sort.svelte';
import { superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
const form = await superValidate(zod4(edit));
const deleteform = await superValidate(zod4(deleteOvertime));
const addform = await superValidate(zod4(add));

// import { minutesToHoursString } from '$lib/global.svelte';
// import Copy from '$lib/Copy.svelte';
import { edit, add, deleteOvertime } from './schema';
import Edit from './edit.svelte';
import Overtime from './overtime.svelte';

export const columns = [
	{
		id: 'select',
		accessorKey: 'id',
		header: ({ table }) =>
			renderComponent(Checkbox, {
				checked: table.getIsAllPageRowsSelected(),
				indeterminate: table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected(),
				onCheckedChange: (value) => table.toggleAllPageRowsSelected(!!value),
				'aria-label': 'Select all'
			}),
		cell: ({ row }) =>
			renderComponent(Checkbox, {
				checked: row.getIsSelected(),
				onCheckedChange: (value) => row.toggleSelected(!!value),
				'aria-label': 'Select row'
			}),
		enableSorting: false,
		enableHiding: false
	},
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
		sortable: true,
		cell: ({ row }) => {
			// You can pass whatever you need from `row.original` to the component
			return renderComponent(DataTableLinks, {
				id: row.original.id,
				name: row.original.name,
				link: '/dashboard/employees/single'
			});
		}
	},

	{
		accessorKey: 'department',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Department',
				onclick: column.getToggleSortingHandler()
			}),
		sortable: true
	},
	{
		accessorKey: 'position',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Position',
				onclick: column.getToggleSortingHandler()
			}),
		sortable: true
	},
	{
		accessorKey: 'site',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Sites',
				onclick: column.getToggleSortingHandler()
			}),
		sortable: true
	},
	// {
	// 	accessorKey: 'overtime',
	// 	header: ({ column }) =>
	// 		renderComponent(DataTableSort, {
	// 			name: 'Overtime',
	// 			onclick: column.getToggleSortingHandler()
	// 		}),
	// 	sortable: true
	// },

	{
		accessorKey: 'overtimeDetails',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Overtime Details',
				onclick: column.getToggleSortingHandler()
			}),
		sortable: true,
		cell: ({ row }) => {
			return renderComponent(Overtime, {
				staffId: row.original.id,
				addForm: addform,
				data: deleteform,
				editForm: form,
				name: row.original.name,
				department: row.original.department,
				site: row.original.site,
				position: row.original.position,
				overtimeDetails: row.original.overtimeDetails,
				totalOvertimePay: row.original.totalOvertimePay
			});
		}
	}
];
