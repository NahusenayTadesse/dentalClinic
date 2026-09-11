import type { ColumnDef } from '@tanstack/table-core';
import type { PageData } from './$types';

/** One row of the table this file describes, taken from the load so the two cannot drift. */
type RowData = NonNullable<PageData['allTransactions']>[number];

import { renderComponent } from '$lib/components/ui/data-table/index.js';
import DataTableLinks from '$lib/components/Table/data-table-links.svelte';
import DataTableActions from './data-table-actions.svelte';
import DataTableSort from '$lib/components/Table/data-table-sort.svelte';
import { formatEthiopianDate } from '$lib/global.svelte';

export const columns: ColumnDef<RowData>[] = [
	{
		accessorKey: 'index',
		header: '#',
		cell: (info) => info.row.index + 1
	},

	{
		accessorKey: 'date',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Paid At',
				onclick: column.getToggleSortingHandler()
			}),
		cell: ({ row }) => {
			return formatEthiopianDate(row.original.date);
		}
	},

	{
		accessorKey: 'amount',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Amount',
				onclick: column.getToggleSortingHandler()
			})
	},

	{
		accessorKey: 'paymentMethods',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Payment Method',
				onclick: column.getToggleSortingHandler()
			})
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
		accessorKey: 'recievedBy',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Recieved By',
				onclick: column.getToggleSortingHandler()
			}),

		cell: ({ row }) => {
			return renderComponent(DataTableLinks, {
				id: row.original.recievedById,
				name: row.original.recievedBy,
				entity: 'user'
			});
		}
	},

	// {
	// 	accessorKey: 'noOfProducts',
	// 	header: ({ column }) =>
	// 		renderComponent(DataTableSort, {
	// 			name: 'No. of Products',
	// 			onclick: column.getToggleSortingHandler()
	// 		}),

	// 	sortable: true
	// },

	// {
	// 	accessorKey: 'noOfServices',
	// 	header: ({ column }) =>
	// 		renderComponent(DataTableSort, {
	// 			name: 'No. of Services',
	// 			onclick: column.getToggleSortingHandler()
	// 		}),

	// 	sortable: true
	// },

	// {
	// 	accessorKey: 'noOfSupplies',
	// 	header: ({ column }) =>
	// 		renderComponent(DataTableSort, {
	// 			name: 'No. of Supplies',
	// 			onclick: column.getToggleSortingHandler()
	// 		}),

	// 	sortable: true
	// },

	{
		accessorKey: 'recieptLink',
		header: 'Reciept',
		cell: ({ row }) => {
			// You can pass whatever you need from `row.original` to the component
			return renderComponent(DataTableLinks, {
				id: row.original.recieptLink,
				name: 'View Reciept',
				link: '/dashboard/files',
				target: '_blank'
			});
		}
	}

	// {
	// 	accessorKey: 'action',
	// 	header: 'Actions',
	// 	cell: ({ row }) => {
	// 		// You can pass whatever you need from `row.original` to the component
	// 		return renderComponent(DataTableActions, {
	// 			id: row.original.id,
	// 			booker: row.original.recievedById,
	// 			recieptLink: row.original.recieptLink,
	// 			date: row.original.date
	// 		});
	// 	}
	// }
];
