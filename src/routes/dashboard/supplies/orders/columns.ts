import type { ColumnDef } from '@tanstack/table-core';
import { renderComponent } from '@nahu/admin-kit/components/ui/data-table/index.js';
import DataTableLinks from '$lib/components/Table/data-table-links.svelte';
import { formatETB } from '$lib/global.svelte';
import { ethiopianDate } from '$lib/tableCells';
import { ORDER_STATUS_LABEL } from '$lib/purchasing';
import type { PageData } from './$types';

/** One order, as the page loads it. */
type OrderRow = PageData['orders'][number];

/** The orders, newest first. The number — or "Draft" — opens the order. */
export const orderColumns: ColumnDef<OrderRow>[] = [
	{
		id: 'number',
		header: 'Order',
		accessorFn: (row) => row.number ?? 'Draft',
		cell: ({ row }) =>
			renderComponent(DataTableLinks, {
				id: row.original.id,
				name: row.original.number ?? 'Draft',
				link: '/dashboard/supplies/orders'
			})
	},
	{ id: 'supplier', header: 'Supplier', accessorFn: (row) => row.supplier },
	{ id: 'status', header: 'Status', accessorFn: (row) => ORDER_STATUS_LABEL[row.status] },
	{
		id: 'orderedOn',
		header: 'Ordered',
		accessorFn: (row) => (row.orderedOn ? ethiopianDate(row.orderedOn) : '—')
	},
	{
		id: 'expectedOn',
		header: 'Expected',
		accessorFn: (row) => (row.expectedOn ? ethiopianDate(row.expectedOn) : '—')
	},
	{ id: 'ordered', header: 'Ordered value', accessorFn: (row) => formatETB(row.ordered) },
	{ id: 'received', header: 'Received value', accessorFn: (row) => formatETB(row.received) },
	{
		id: 'invoiced',
		header: 'Invoiced',
		accessorFn: (row) =>
			row.overInvoiced ? `${formatETB(row.invoiced)} — more than arrived` : formatETB(row.invoiced)
	}
];
