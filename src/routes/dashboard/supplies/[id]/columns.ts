import type { ColumnDef } from '@tanstack/table-core';
import type { PageData } from './$types';

/** One row of the table this file describes, taken from the load so the two cannot drift. */
type RowData = NonNullable<PageData['suppliers']>[number];

import { renderComponent } from '$lib/components/ui/data-table/index.js';
import DataTableSort from '$lib/components/Table/data-table-sort.svelte';
import Statuses from '$lib/components/Table/statuses.svelte';
import Copy from '$lib/Copy.svelte';
import DataTableLinks from '$lib/components/Table/data-table-links.svelte';
import ExpiryCell from '$lib/components/Table/expiry-cell.svelte';
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
		accessorKey: 'status',
		header: 'Status',
		cell: ({ row }) => {
			return renderComponent(Statuses, {
				status: row.original.status ? 'Active' : 'Inactive'
			});
		}
	}
];

/**
 * How far ahead a lot counts as expiring. Three months is the window to use a box up, move it to
 * the busier chair, or ask the supplier to swap it, before it has to be written off.
 */
export const LOT_WARNING_DAYS = 90;

type LotRow = PageData['lots'][number];

/**
 * The lots still holding stock, in the order they will be used — so the columns do not sort: the
 * top row is the next box to open, and re-sorting would hide that.
 */
export const lotColumns: ColumnDef<LotRow>[] = [
	{
		accessorKey: 'expiryDate',
		header: 'Expires',
		cell: ({ row }) =>
			renderComponent(ExpiryCell, {
				expiresOn: row.original.expiryDate,
				warningDays: LOT_WARNING_DAYS,
				noneText: 'Does not expire'
			})
	},
	{ accessorKey: 'quantity', header: 'In this lot' },
	{
		accessorKey: 'batchNumber',
		header: 'Lot number',
		cell: ({ row }) => row.original.batchNumber ?? '—'
	},
	{
		accessorKey: 'receivedOn',
		header: 'Received',
		cell: ({ row }) => ethiopianDate(row.original.receivedOn)
	},
	{
		accessorKey: 'supplier',
		header: 'Supplier',
		cell: ({ row }) => row.original.supplier ?? '—'
	}
];
