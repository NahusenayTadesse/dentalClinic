import { renderComponent } from '$lib/components/ui/data-table/index.js';
import DataTableLinks from '$lib/components/Table/data-table-links.svelte';
import Stasuses from '$lib/components/Table/statuses.svelte';
import DataTableSort from '$lib/components/Table/data-table-sort.svelte';
import { superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
const form = await superValidate(zod4(edit));

import { minutesToHoursString } from '$lib/global.svelte';
import Copy from '$lib/Copy.svelte';
import { edit } from './schema';
import Edit from './edit.svelte';
import ReasonsDialog from './reasons-dialog.svelte';

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
		accessorKey: 'reasons',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Absent Details',
				onclick: column.getToggleSortingHandler()
			}),
		sortable: true,
		cell: ({ row }) => {
			return renderComponent(ReasonsDialog, {
				staff: row.original
			});
		}
	},

	{
		accessorKey: 'absent',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Missing Days',
				onclick: column.getToggleSortingHandler()
			}),
		sortable: true,
		cell: ({ row }) => {
			// You can pass whatever you need from `row.original` to the component
			return renderComponent(Edit, {
				data: form,
				id: row.original.id,
				name: row.original.name,
				count: row.original.absent
			});
		}
	},

	{
		accessorKey: 'deductable',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Deductable',
				onclick: column.getToggleSortingHandler()
			}),
		sortable: true,
		cell: ({ row }) => {
			// You can pass whatever you need from `row.original` to the component
			return renderComponent(Edit, {
				data: form,
				id: row.original.id,
				name: row.original.name,
				count: row.original.deductable,
				days: row.original.deductableDays
			});
		}
	},

	{
		accessorKey: 'nonDeductable',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Non Deductable',
				onclick: column.getToggleSortingHandler()
			}),
		sortable: true,
		cell: ({ row }) => {
			// You can pass whatever you need from `row.original` to the component
			return renderComponent(Edit, {
				data: form,
				id: row.original.id,
				name: row.original.name,
				count: row.original.nonDeductable,
				days: row.original.nonDeductableDays
			});
		}
	},

	{
		accessorKey: 'nonDeductable',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Missing Days',
				onclick: column.getToggleSortingHandler()
			}),
		sortable: true,
		cell: ({ row }) => {
			// You can pass whatever you need from `row.original` to the component
			return renderComponent(Edit, {
				data: form,
				id: row.original.id,
				name: row.original.name,
				count: row.original.nonDeductable
			});
		}
	},

	// {
	// 	accessorKey: 'phone',
	// 	header: 'Phone',
	// 	sortable: true,
	// 	cell: ({ row }) => renderComponent(Copy, { data: row.original.phone })
	// },

	// { accessorKey: 'email', header: 'Email' },

	{
		accessorKey: 'status',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Status',
				onclick: column.getToggleSortingHandler()
			}),
		sortable: true
	}
];
