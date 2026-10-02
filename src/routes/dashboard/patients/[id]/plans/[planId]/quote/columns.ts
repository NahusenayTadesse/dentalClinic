import type { ColumnDef } from '@tanstack/table-core';
import { formatETB } from '$lib/global.svelte';
import type { PageData } from './$types';

type Line = PageData['plan']['lines'][number];

const right = { meta: { align: 'right' } } as const;

/**
 * A quote's lines on paper. Once the patient has decided, each line says whether it was agreed —
 * before the total rather than after it, so the totals under the table sit under the money.
 */
export function quoteColumns(decided: boolean): ColumnDef<Line>[] {
	return [
		{ accessorKey: 'description', header: 'Treatment' },
		{ accessorKey: 'quantity', header: 'Qty', ...right },
		{
			id: 'price',
			header: 'Price',
			cell: ({ row }) => formatETB(row.original.unitPrice),
			...right
		},
		...(decided
			? [
					{
						id: 'agreed',
						header: 'Agreed',
						cell: ({ row }) => (row.original.decision === 'accepted' ? 'Yes' : 'No')
					} satisfies ColumnDef<Line>
				]
			: []),
		{ id: 'total', header: 'Total', cell: ({ row }) => formatETB(row.original.lineTotal), ...right }
	];
}
