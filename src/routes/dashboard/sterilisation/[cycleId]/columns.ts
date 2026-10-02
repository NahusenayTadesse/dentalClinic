import type { ColumnDef } from '@tanstack/table-core';
import { renderComponent } from '@nahu/admin-kit/components/ui/data-table/index.js';
import DataTableLinks from '$lib/components/Table/data-table-links.svelte';
import { ethiopianDate, ethiopianDateTime } from '$lib/tableCells';
import { PACK_STATE_LABEL } from '$lib/sterilisation';
import type { PageData } from './$types';

/** One pack of the cycle, as the page loads it. */
type PackRow = PageData['packs'][number];

/** The cycle's packs: what each held, until when, and who it was opened for. */
export const packColumns: ColumnDef<PackRow>[] = [
	{ id: 'code', header: 'Code', accessorFn: (row) => row.code },
	{ id: 'contents', header: 'Contents', accessorFn: (row) => row.contents ?? '—' },
	{ id: 'expiresOn', header: 'Sterile until', accessorFn: (row) => ethiopianDate(row.expiresOn) },
	{ id: 'state', header: 'State', accessorFn: (row) => PACK_STATE_LABEL[row.state] },
	{
		id: 'patient',
		header: 'Used on',
		accessorFn: (row) => row.patient ?? '—',
		cell: ({ row }) =>
			row.original.patientId
				? renderComponent(DataTableLinks, {
						entity: 'patient',
						id: row.original.patientId,
						name: row.original.patient ?? 'Patient'
					})
				: '—'
	},
	{
		id: 'usedAt',
		header: 'When',
		accessorFn: (row) => (row.usedAt ? ethiopianDateTime(row.usedAt) : '—')
	}
];
