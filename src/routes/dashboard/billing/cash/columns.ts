import type { ColumnDef } from '@tanstack/table-core';
import { formatETB } from '$lib/global.svelte';
import { ethiopianDateTime } from '$lib/tableCells';
import type { Messages } from '$lib/i18n/messages';
import type { PageData } from './$types';

/** One counted day. */
type Row = PageData['closed'][number];

/**
 * The last counts, newest first, headed in the viewer's language. The variance is counted less
 * expected — never stored.
 */
export function countColumns(m: Messages): ColumnDef<Row>[] {
	const w = m.billing.cash;
	return [
		{
			id: 'closedAt',
			header: w.counted,
			accessorFn: (row) => row.closedAt,
			cell: ({ row }) => ethiopianDateTime(row.original.closedAt)
		},
		{ id: 'by', header: w.by, accessorFn: (row) => row.closedBy ?? '—' },
		{
			accessorKey: 'expectedAmount',
			header: w.expected,
			cell: ({ row }) => formatETB(row.original.expectedAmount)
		},
		{
			accessorKey: 'countedAmount',
			header: w.counted,
			cell: ({ row }) => formatETB(row.original.countedAmount)
		},
		{
			accessorKey: 'variance',
			header: w.overShort,
			cell: ({ row }) =>
				row.original.variance === 0
					? w.balanced
					: `${row.original.variance > 0 ? '+' : '−'}${formatETB(Math.abs(row.original.variance))}`
		},
		{
			accessorKey: 'bankedAmount',
			header: w.banked,
			cell: ({ row }) => formatETB(row.original.bankedAmount)
		},
		{ id: 'note', header: m.common.note, accessorFn: (row) => row.note ?? '' }
	];
}
