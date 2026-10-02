import type { ColumnDef } from '@tanstack/table-core';
import { formatETB, formatEthiopianDate } from '$lib/global.svelte';
import type { PageData } from './$types';

type Line = PageData['bill']['lines'][number];
type Paid = PageData['bill']['payments'][number];

const right = { meta: { align: 'right' } } as const;

/** A bill's lines on paper: what, how many, at what price, for how much. */
export const lineColumns: ColumnDef<Line>[] = [
	{ accessorKey: 'description', header: 'What' },
	{ accessorKey: 'quantity', header: 'Qty', ...right },
	{ id: 'price', header: 'Price', cell: ({ row }) => formatETB(row.original.unitPrice), ...right },
	{ id: 'total', header: 'Total', cell: ({ row }) => formatETB(row.original.lineTotal), ...right }
];

/** The payments against it, each with the receipt number it was given. */
export const paymentColumns: ColumnDef<Paid>[] = [
	{
		id: 'paid',
		header: 'Paid',
		cell: ({ row }) =>
			row.original.occurredOn ? formatEthiopianDate(new Date(row.original.occurredOn)) : '—'
	},
	{
		id: 'receipt',
		header: 'Receipt',
		cell: ({ row }) =>
			`${row.original.receiptNumber ?? '—'}${row.original.direction === 'out' ? ' (refund)' : ''}`
	},
	{ id: 'how', header: 'How', cell: ({ row }) => row.original.method ?? '—' },
	{ id: 'amount', header: 'Amount', cell: ({ row }) => formatETB(row.original.amount), ...right }
];
