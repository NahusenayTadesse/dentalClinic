import type { ColumnDef } from '@tanstack/table-core';
import { formatETB } from '$lib/global.svelte';
import { ethiopianDateTime } from '$lib/tableCells';
import type { PageData } from './$types';

/** One counted day. */
type Row = PageData['closed'][number];

/** The last counts, newest first. The variance is counted less expected — never stored. */
export const columns: ColumnDef<Row>[] = [
	{
		id: 'closedAt',
		header: 'Counted',
		accessorFn: (row) => row.closedAt,
		cell: ({ row }) => ethiopianDateTime(row.original.closedAt)
	},
	{ id: 'by', header: 'By', accessorFn: (row) => row.closedBy ?? '—' },
	{
		accessorKey: 'expectedAmount',
		header: 'Expected',
		cell: ({ row }) => formatETB(row.original.expectedAmount)
	},
	{
		accessorKey: 'countedAmount',
		header: 'Counted',
		cell: ({ row }) => formatETB(row.original.countedAmount)
	},
	{
		accessorKey: 'variance',
		header: 'Over / short',
		cell: ({ row }) =>
			row.original.variance === 0
				? 'Balanced'
				: `${row.original.variance > 0 ? '+' : '−'}${formatETB(Math.abs(row.original.variance))}`
	},
	{
		accessorKey: 'bankedAmount',
		header: 'Banked',
		cell: ({ row }) => formatETB(row.original.bankedAmount)
	},
	{ id: 'note', header: 'Note', accessorFn: (row) => row.note ?? '' }
];
