import type { ColumnDef } from '@tanstack/table-core';
import type { PageData } from './$types';

type Performance = PageData['performance'][number];

const right = { meta: { align: 'right' } } as const;
const days = (n: number | null | undefined) => (n ? `${n} days` : '—');

/** How each laboratory has done over the past year: volume, turnaround, lateness, remakes. */
export const performanceColumns: ColumnDef<Performance>[] = [
	{ accessorKey: 'lab', header: 'Laboratory' },
	{ accessorKey: 'cases', header: 'Cases', ...right },
	{
		id: 'promised',
		header: 'Usually says',
		cell: ({ row }) => days(row.original.promised),
		...right
	},
	{
		id: 'averageDays',
		header: 'Took on average',
		cell: ({ row }) =>
			row.original.averageDays === null ? '—' : `${row.original.averageDays} days`,
		...right
	},
	{
		id: 'late',
		header: 'Late',
		cell: ({ row }) =>
			`${row.original.late}${row.original.averageLateDays ? ` · ${row.original.averageLateDays} days on average` : ''}`,
		...right
	},
	{ accessorKey: 'remakes', header: 'Remakes', ...right }
];
