import type { ColumnDef } from '@tanstack/table-core';
import { renderComponent } from '@nahu/admin-kit/components/ui/data-table/index.js';
import Statuses from '@nahu/admin-kit/components/Table/statuses.svelte';
import DataTableLinks from '$lib/components/Table/data-table-links.svelte';
import { formatETB } from '$lib/global.svelte';
import { ethiopianDate } from '$lib/tableCells';
import type { PageData } from './$types';

/** One transaction, as the load returns it. */
type Row = PageData['rows'][number];

/**
 * The transactions columns. Ids match the facet and sort keys in the load, which is what puts
 * each filter in its own header and each sort on the server.
 */
export const columns: ColumnDef<Row>[] = [
	{
		id: 'date',
		header: 'Date',
		accessorFn: (row) => row.date,
		cell: ({ row }) => ethiopianDate(row.original.date)
	},
	{
		id: 'direction',
		header: 'In / out',
		accessorFn: (row) => (row.direction === 'in' ? 'Money in' : 'Money out')
	},
	{
		id: 'amount',
		header: 'Amount',
		accessorFn: (row) => row.amount,
		cell: ({ row }) => formatETB(Math.abs(row.original.amount ?? 0)),
		meta: { align: 'right' }
	},
	{ id: 'paymentMethod', header: 'Payment method', accessorFn: (row) => row.paymentMethod ?? '—' },
	{
		id: 'paymentStatus',
		header: 'Payment',
		accessorFn: (row) => row.paymentStatus ?? '',
		cell: ({ row }) => renderComponent(Statuses, { status: row.original.paymentStatus ?? '' })
	},
	{
		id: 'approvalStatus',
		header: 'Approval',
		accessorFn: (row) => row.approvalStatus ?? '',
		cell: ({ row }) => renderComponent(Statuses, { status: row.original.approvalStatus ?? '' })
	},
	{ id: 'receiptNumber', header: 'Receipt no.', accessorFn: (row) => row.receiptNumber ?? '—' },
	{ id: 'description', header: 'Description', accessorFn: (row) => row.description ?? '' },
	{
		id: 'recievedBy',
		header: 'Recorded by',
		accessorFn: (row) => row.recievedBy ?? '',
		cell: ({ row }) =>
			renderComponent(DataTableLinks, {
				id: row.original.recievedById,
				name: row.original.recievedBy,
				entity: 'user'
			})
	},
	{
		id: 'recieptLink',
		header: 'Receipt',
		cell: ({ row }) =>
			row.original.recieptLink
				? renderComponent(DataTableLinks, {
						id: row.original.recieptLink,
						name: 'View',
						link: '/dashboard/files',
						target: '_blank'
					})
				: '—'
	}
];
