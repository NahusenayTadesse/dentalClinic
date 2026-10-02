import type { ColumnDef } from '@tanstack/table-core';
import { renderComponent } from '@nahu/admin-kit/components/ui/data-table/index.js';
import DataTableLinks from '$lib/components/Table/data-table-links.svelte';
import { ethiopianDateTime } from '$lib/tableCells';
import { CYCLE_KIND_LABEL, CYCLE_STATUS_LABEL } from '$lib/sterilisation';
import type { PageData } from './$types';

/** One cycle in the log, as the page loads it. */
type CycleRow = PageData['cycles'][number];

const INDICATOR = { pass: 'Pass', fail: 'Fail', pending: 'Pending', none: '—' } as const;

/**
 * The log, newest first. The cycle number opens the cycle — its packs and who they were used on.
 * `status` holds the words a reader filters by.
 */
export const cycleColumns: ColumnDef<CycleRow>[] = [
	{
		id: 'cycle',
		header: 'Cycle',
		accessorFn: (row) => `${row.steriliser} #${row.cycleNo}`,
		cell: ({ row }) =>
			renderComponent(DataTableLinks, {
				id: row.original.id,
				name: `${row.original.steriliser} #${row.original.cycleNo}`,
				link: '/dashboard/sterilisation'
			})
	},
	{ id: 'ranAt', header: 'Ran', accessorFn: (row) => ethiopianDateTime(row.ranAt) },
	{ id: 'kind', header: 'Kind', accessorFn: (row) => CYCLE_KIND_LABEL[row.kind] },
	{ id: 'program', header: 'Program', accessorFn: (row) => row.program ?? '—' },
	{ id: 'chemical', header: 'Strip', accessorFn: (row) => INDICATOR[row.chemical] },
	{ id: 'biological', header: 'Spore test', accessorFn: (row) => INDICATOR[row.biological] },
	{ id: 'status', header: 'Result', accessorFn: (row) => CYCLE_STATUS_LABEL[row.status] },
	{
		id: 'packs',
		header: 'Packs used',
		accessorFn: (row) => (row.packs ? `${row.used} of ${row.packs}` : '—')
	}
];
