import type { ColumnDef } from '@tanstack/table-core';
import { renderComponent } from '@nahu/admin-kit/components/ui/data-table/index.js';
import DataTableLinks from '$lib/components/Table/data-table-links.svelte';
import Copy from '$lib/Copy.svelte';
import { formatETB } from '$lib/global.svelte';
import { ethiopianDate } from '$lib/tableCells';
import type { PageData } from './$types';

/** One quote awaiting an answer. */
type Row = PageData['waiting'][number];

/**
 * The follow-up list. The patient's name opens their chart (checked against the viewer's access,
 * CLAUDE.md §12); "Open plan" goes straight to the quote, where the answer is recorded.
 */
export const columns: ColumnDef<Row>[] = [
	{
		id: 'patient',
		header: 'Patient',
		accessorFn: (row) => row.patient,
		cell: ({ row }) =>
			renderComponent(DataTableLinks, {
				entity: 'patient',
				id: row.original.patientId,
				name: row.original.patient
			})
	},
	{
		accessorKey: 'phone',
		header: 'Phone',
		cell: ({ row }) => renderComponent(Copy, { data: row.original.phone })
	},
	{
		id: 'provider',
		header: 'Proposed by',
		accessorFn: (row) => row.provider ?? '—'
	},
	{
		id: 'presentedOn',
		header: 'Presented',
		accessorFn: (row) => row.presentedOn,
		cell: ({ row }) => ethiopianDate(row.original.presentedOn)
	},
	{
		accessorKey: 'waitingDays',
		header: 'Waiting',
		cell: ({ row }) => `${row.original.waitingDays} days`
	},
	{
		accessorKey: 'quoted',
		header: 'Quoted',
		cell: ({ row }) => formatETB(row.original.quoted)
	},
	{
		id: 'validUntil',
		header: 'Stands until',
		accessorFn: (row) => row.validUntil,
		cell: ({ row }) => ethiopianDate(row.original.validUntil)
	},
	{
		id: 'open',
		header: '',
		cell: ({ row }) =>
			renderComponent(DataTableLinks, {
				id: row.original.id,
				name: 'Open plan',
				link: `/dashboard/patients/${row.original.patientId}/plans`
			})
	}
];
