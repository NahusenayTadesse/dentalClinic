import { renderComponent } from '$lib/components/ui/data-table/index.js';
import DataTableLinks from '$lib/components/Table/data-table-links.svelte';
import DataTableActions from './data-table-actions.svelte';
import DataTableSort from '$lib/components/Table/data-table-sort.svelte';
import { formatEthiopianDate, minutesToHoursString } from '$lib/global.svelte';
import Copy from '$lib/Copy.svelte';

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
		accessorKey: 'education',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Educational Level',
				onclick: column.getToggleSortingHandler()
			}),
		sortable: true
	},
	{
		accessorKey: 'terminationDate',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Termination Date',
				onclick: column.getToggleSortingHandler()
			}),
		sortable: true,
		cell: (info) => formatEthiopianDate(info.getValue()) || formatEthiopianDate(new Date())
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
		accessorKey: 'actions',
		header: 'Actions',
		cell: ({ row }) => {
			// You can pass whatever you need from `row.original` to the component
			return renderComponent(DataTableActions, { id: row.original.id, name: row.original.name });
		}
	}
];
