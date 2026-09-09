import type { ColumnDef } from '@tanstack/table-core';
import type { PageData } from './$types';

/** One row of the table this file describes, taken from the load so the two cannot drift. */
type RowData = NonNullable<PageData['allData']>[number];

import { renderComponent } from '$lib/components/ui/data-table/index.js';
import DataTableSort from '$lib/components/Table/data-table-sort.svelte';
import Statuses from '$lib/components/Table/statuses.svelte';
import Address from '$lib/components/Table/address.svelte';
import Copy from '$lib/Copy.svelte';

import Edit from './edit.svelte';
import DataTableLinks from '$lib/components/Table/data-table-links.svelte';
import { ethiopianDate } from '$lib/tableCells';
export const columns: ColumnDef<RowData>[] = [
	{
		accessorKey: 'index',
		header: '#',
		cell: (info) => info.row.index + 1,
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
				link: `/dashboard/supplies/suppliers`
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
		accessorKey: 'description',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Description',
				onclick: column.getToggleSortingHandler()
			}),
		cell: ({ row }) => {
			// You can pass whatever you need from `row.original` to the component
			return renderComponent(Copy, {
				data: row.original.description
			});
		}
	},

	{
		accessorKey: '',
		header: 'Address',
		cell: ({ row }) => {
			// You can pass whatever you need from `row.original` to the component
			return renderComponent(Address, {
				street: row.original.street,
				buildingNumber: row.original.buildingNumber,
				floor: row.original.floor,
				subcity: row.original.subcity,
				kebele: row.original.kebele,
				houseNumber: row.original.houseNumber
			});
		}
	},

	{
		accessorKey: 'deliveries',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Deliveries',
				onclick: column.getToggleSortingHandler()
			}),
		cell: (info) => (Number(info.getValue()) === 0 ? 'Never supplied' : info.getValue())
	},
	{
		accessorKey: 'itemsSupplied',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Items Carried',
				onclick: column.getToggleSortingHandler()
			}),
		cell: (info) => (Number(info.getValue()) === 0 ? '—' : info.getValue())
	},
	{
		accessorKey: 'totalSpend',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Total Spend',
				onclick: column.getToggleSortingHandler()
			}),
		cell: (info) =>
			Number(info.getValue()).toLocaleString('en-US', {
				minimumFractionDigits: 2,
				maximumFractionDigits: 2
			})
	},
	{
		accessorKey: 'lastDelivery',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Last Delivery',
				onclick: column.getToggleSortingHandler()
			}),
		cell: (info) => ethiopianDate(info.getValue())
	},
	{
		accessorKey: 'status',
		header: 'Status',
		cell: ({ row }) => {
			return renderComponent(Statuses, {
				status: row.original.status ? 'Active' : 'Inactive'
			});
		}
	}
];
