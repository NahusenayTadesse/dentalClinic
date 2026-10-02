import type { ColumnDef } from '@tanstack/table-core';
import type { PageData } from './$types';

/** One row of the table this file describes, taken from the load so the two cannot drift. */
type RowData = NonNullable<PageData['suppliers']>[number];

import { renderComponent } from '@nahu/admin-kit/components/ui/data-table/index.js';
import DataTableSort from '@nahu/admin-kit/components/Table/data-table-sort.svelte';
import Statuses from '@nahu/admin-kit/components/Table/statuses.svelte';
import Copy from '@nahu/admin-kit/Copy.svelte';
import DataTableLinks from '$lib/components/Table/data-table-links.svelte';
import ExpiryCell from '@nahu/admin-kit/components/Table/expiry-cell.svelte';
import { ethiopianDate } from '$lib/tableCells';
import { LOT_WARNING_DAYS } from '$lib/lots';
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

type RecipientRow = NonNullable<PageData['recipients']>[number];

/**
 * Who received this item, lot by lot — the trace a recall notice is checked against. The lot
 * number is the facet, because the notice names one; the patient links to their chart.
 */
export const recipientColumns: ColumnDef<RecipientRow>[] = [
	{
		id: 'batchNumber',
		header: 'Lot number',
		accessorFn: (row) => row.batchNumber ?? 'No lot number'
	},
	{
		id: 'expiryDate',
		header: 'Lot expires',
		accessorFn: (row) => row.expiryDate,
		cell: ({ row }) => ethiopianDate(row.original.expiryDate)
	},
	{
		id: 'patient',
		header: 'Patient',
		accessorFn: (row) => row.patient,
		cell: ({ row }) =>
			renderComponent(DataTableLinks, {
				entity: 'patient',
				id: row.original.patientId,
				name: row.original.patient
			})
	},
	{ id: 'fileNo', header: 'File', accessorFn: (row) => row.fileNo ?? '—' },
	{
		id: 'phone',
		header: 'Phone',
		accessorFn: (row) => row.phone ?? '',
		cell: ({ row }) => renderComponent(Copy, { data: row.original.phone ?? '' })
	},
	{ id: 'quantity', header: 'Quantity', accessorFn: (row) => Math.abs(row.quantity) },
	{
		id: 'at',
		header: 'Given',
		accessorFn: (row) => row.at,
		cell: ({ row }) => ethiopianDate(row.original.at)
	}
];
