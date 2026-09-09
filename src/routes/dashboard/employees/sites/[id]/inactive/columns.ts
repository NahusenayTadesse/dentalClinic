import type { ColumnDef } from '@tanstack/table-core';
import type { PageData } from './$types';

/** One row of the table this file describes, taken from the load so the two cannot drift. */
type RowData = NonNullable<PageData['staffList']>[number];

import { renderComponent } from '$lib/components/ui/data-table/index.js';
import DataTableLinks from '$lib/components/Table/data-table-links.svelte';
import DataTableActions from './data-table-actions.svelte';
import DataTableSort from '$lib/components/Table/data-table-sort.svelte';
import { formatEthiopianDate, minutesToHoursString } from '$lib/global.svelte';
import Copy from '$lib/Copy.svelte';

export const columns: ColumnDef<RowData>[] = [
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
			})
	},
	{
		accessorKey: 'education',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Educational Level',
				onclick: column.getToggleSortingHandler()
			})
	},
	{
		accessorKey: 'terminationDate',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Termination Date',
				onclick: column.getToggleSortingHandler()
			}),
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
			})
	},

	{
		accessorKey: 'years',

		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Years of Service',
				onclick: column.getToggleSortingHandler()
			})
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
