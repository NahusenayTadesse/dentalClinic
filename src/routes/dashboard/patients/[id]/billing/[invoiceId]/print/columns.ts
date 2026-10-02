import type { ColumnDef } from '@tanstack/table-core';
import { formatETB, formatEthiopianDate } from '$lib/global.svelte';
import type { Messages } from '$lib/i18n/messages';
import type { PageData } from './$types';

type Line = PageData['bill']['lines'][number];
type Paid = PageData['bill']['payments'][number];

const right = { meta: { align: 'right' } } as const;

/** A bill's lines on paper: what, how many, at what price, for how much. */
export function lineColumns(m: Messages): ColumnDef<Line>[] {
	const w = m.billing.print;
	return [
		{ accessorKey: 'description', header: w.what },
		{ accessorKey: 'quantity', header: w.qty, ...right },
		{
			id: 'price',
			header: w.price,
			cell: ({ row }) => formatETB(row.original.unitPrice),
			...right
		},
		{ id: 'total', header: w.total, cell: ({ row }) => formatETB(row.original.lineTotal), ...right }
	];
}

/** The payments against it, each with the receipt number it was given. */
export function paymentColumns(m: Messages): ColumnDef<Paid>[] {
	const w = m.billing.print;
	return [
		{
			id: 'paid',
			header: w.paid,
			cell: ({ row }) =>
				row.original.occurredOn ? formatEthiopianDate(new Date(row.original.occurredOn)) : '—'
		},
		{
			id: 'receipt',
			header: w.receipt,
			cell: ({ row }) =>
				`${row.original.receiptNumber ?? '—'}${row.original.direction === 'out' ? w.refundMark : ''}`
		},
		{ id: 'how', header: w.how, cell: ({ row }) => row.original.method ?? '—' },
		{ id: 'amount', header: w.amount, cell: ({ row }) => formatETB(row.original.amount), ...right }
	];
}
