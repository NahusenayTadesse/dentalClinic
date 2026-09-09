import { renderComponent } from '$lib/components/ui/data-table/index.js';
import DataTableLinks from '$lib/components/Table/data-table-links.svelte';
import Stasuses from '$lib/components/Table/statuses.svelte';
import DataTableActions from './data-table-actions.svelte';
import DataTableSort from '$lib/components/Table/data-table-sort.svelte';
import { superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
const form = await superValidate(zod4(edit));

import { minutesToHoursString } from '$lib/global.svelte';
import Copy from '$lib/Copy.svelte';
import { edit } from './schema';
import Edit from './edit.svelte';

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
		accessorKey: 'position',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Position',
				onclick: column.getToggleSortingHandler()
			}),
		sortable: true
	},

	{
		accessorKey: 'education',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Educational Level',
				onclick: column.getToggleSortingHandler()
			}),
		sortable: true
	},
	// {
	// 	accessorKey: 'absent',
	// 	header: ({ column }) =>
	// 		renderComponent(DataTableSort, {
	// 			name: 'Missing Days',
	// 			onclick: column.getToggleSortingHandler()
	// 		}),
	// 	sortable: true,
	// 	cell: ({ row }) => {
	// 		// You can pass whatever you need from `row.original` to the component
	// 		return renderComponent(Edit, {
	// 			data: form,
	// 			id: row.original.id,
	// 			name: row.original.name,
	// 			count: row.original.absent
	// 		});
	// 	}
	// },

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
	},

	{
		accessorKey: 'years',

		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Years of Service',
				onclick: column.getToggleSortingHandler()
			}),
		sortable: true,
		filterVariant: 'range'
	},

	{
		accessorKey: 'missingInformation',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Missing information',
				onclick: column.getToggleSortingHandler()
			}),
		cell: ({ row }) => {
			// You can pass whatever you need from `row.original` to the component
			return renderComponent(Stasuses, {
				status: row.original.guarantor > 0 && row.original.accounts > 0 ? 'Complete' : 'Incomplete'
			});
		}
	},

	{
		accessorKey: 'actions',
		header: 'Actions',
		cell: ({ row }) => {
			// You can pass whatever you need from `row.original` to the component
			return renderComponent(DataTableActions, { id: row.original.id, name: row.original.name });
		}
	}
];
